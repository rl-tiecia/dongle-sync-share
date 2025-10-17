# Implementação T-Dongle S3 - Sistema de Múltiplos Dispositivos

## Visão Geral
Este documento descreve como implementar a comunicação entre o T-Dongle S3 e o sistema web de monitoramento para suportar múltiplos dispositivos.

## Arquitetura

```
ESP32-S3 (T-Dongle) <-> WiFi <-> Internet <-> Supabase <-> Web Dashboard
```

## Estrutura do Banco de Dados

### Tabela: `devices`
Armazena informações dos dispositivos registrados.

```sql
- id (UUID): ID único do dispositivo no sistema
- user_id (UUID): ID do usuário proprietário
- device_name (TEXT): Nome amigável do dispositivo
- device_id (TEXT): ID único do hardware (UNIQUE)
- mac_address (TEXT): Endereço MAC WiFi
- firmware_version (TEXT): Versão do firmware
- last_seen_at (TIMESTAMP): Último contato do dispositivo
- is_online (BOOLEAN): Status online/offline
- created_at, updated_at (TIMESTAMP)
```

### Tabela: `device_status`
Status em tempo real do dispositivo.

```sql
- id (UUID): ID do registro
- device_id (UUID): Referência para devices.id
- display_active (BOOLEAN): Display ativo
- wifi_connected (BOOLEAN): WiFi conectado
- usb_host_active (BOOLEAN): USB host ativo
- transfer_active (BOOLEAN): Transferência em andamento
- storage_used_mb (BIGINT): Espaço usado em MB
- total_backups (INTEGER): Total de backups
- created_at (TIMESTAMP)
```

### Tabela: `device_backups`
Registros de backups realizados.

```sql
- id (UUID): ID do backup
- device_id (UUID): Referência para devices.id
- filename (TEXT): Nome do arquivo
- file_size_mb (NUMERIC): Tamanho em MB
- backup_type (TEXT): Tipo do backup
- status (TEXT): Status (completed, failed, etc)
- destination (TEXT): Destino do backup
- created_at (TIMESTAMP)
```

### Tabela: `device_logs`
Logs do dispositivo.

```sql
- id (UUID): ID do log
- device_id (UUID): Referência para devices.id
- log_level (TEXT): Nível (info, warning, error)
- message (TEXT): Mensagem do log
- created_at (TIMESTAMP)
```

## Implementação no ESP32-S3

### 1. Bibliotecas Necessárias

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Time.h>

// Opcional: para UUID
#include <esp_system.h>
```

### 2. Configuração Inicial

```cpp
// Configurações WiFi
const char* WIFI_SSID = "SUA_REDE";
const char* WIFI_PASSWORD = "SUA_SENHA";

// Configurações Supabase
const char* SUPABASE_URL = "https://eoqlgszxbiezdfmsakxq.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWxnc3p4YmllemRmbXNha3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NjA0NTEsImV4cCI6MjA3NjIzNjQ1MX0.cV8Ks6pNJVeLx-4NkSbNyaEwuz_fPjM5SxUn7wHWsFA";

// ID único do dispositivo (gerar baseado no MAC)
String DEVICE_ID;
String deviceUUID; // UUID do banco após registro

void setup() {
  Serial.begin(115200);
  
  // Gerar ID único do dispositivo
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  DEVICE_ID = String(mac[0], HEX) + String(mac[1], HEX) + 
              String(mac[2], HEX) + String(mac[3], HEX) + 
              String(mac[4], HEX) + String(mac[5], HEX);
  DEVICE_ID.toUpperCase();
  
  // Conectar WiFi
  connectWiFi();
  
  // Registrar dispositivo
  registerDevice();
  
  // Iniciar heartbeat
  xTaskCreate(heartbeatTask, "Heartbeat", 4096, NULL, 1, NULL);
}
```

### 3. Função de Conexão WiFi

```cpp
void connectWiFi() {
  Serial.println("Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}
```

### 4. Registro do Dispositivo

```cpp
bool registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  // Preparar JSON
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["device_name"] = "T-Dongle-" + DEVICE_ID.substring(0, 6);
  doc["mac_address"] = WiFi.macAddress();
  doc["firmware_version"] = "1.0.0";
  doc["is_online"] = true;
  
  // IMPORTANTE: Você precisa associar ao user_id
  // Por enquanto, vamos deixar como null ou usar um sistema de autenticação
  // doc["user_id"] = "UUID_DO_USUARIO";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("Registrando dispositivo...");
  int httpCode = http.POST(jsonBody);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Resposta: " + response);
    
    // Extrair UUID do dispositivo da resposta
    StaticJsonDocument<1024> responseDoc;
    deserializeJson(responseDoc, response);
    
    if (responseDoc.is<JsonArray>()) {
      JsonArray arr = responseDoc.as<JsonArray>();
      if (arr.size() > 0) {
        deviceUUID = arr[0]["id"].as<String>();
        Serial.println("Device UUID: " + deviceUUID);
      }
    }
  } else {
    Serial.println("Erro: " + String(httpCode));
  }
  
  http.end();
  return httpCode == 201 || httpCode == 200;
}
```

### 5. Atualização de Status (Heartbeat)

```cpp
void heartbeatTask(void* parameter) {
  while (true) {
    updateDeviceStatus();
    vTaskDelay(30000 / portTICK_PERIOD_MS); // A cada 30 segundos
  }
}

void updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.isEmpty()) return;
  
  HTTPClient http;
  
  // 1. Atualizar last_seen e is_online no devices
  String deviceUrl = String(SUPABASE_URL) + "/rest/v1/devices?id=eq." + deviceUUID;
  http.begin(deviceUrl);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> deviceDoc;
  deviceDoc["last_seen_at"] = getCurrentTimestamp();
  deviceDoc["is_online"] = true;
  
  String deviceJson;
  serializeJson(deviceDoc, deviceJson);
  http.PATCH(deviceJson);
  http.end();
  
  // 2. Inserir status atual
  String statusUrl = String(SUPABASE_URL) + "/rest/v1/device_status";
  http.begin(statusUrl);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<512> statusDoc;
  statusDoc["device_id"] = deviceUUID;
  statusDoc["display_active"] = true; // Seu código aqui
  statusDoc["wifi_connected"] = WiFi.status() == WL_CONNECTED;
  statusDoc["usb_host_active"] = checkUSBHost(); // Sua função
  statusDoc["transfer_active"] = isTransferring(); // Sua função
  statusDoc["storage_used_mb"] = getStorageUsed(); // Sua função
  statusDoc["total_backups"] = getTotalBackups(); // Sua função
  
  String statusJson;
  serializeJson(statusDoc, statusJson);
  http.POST(statusJson);
  http.end();
}

String getCurrentTimestamp() {
  // Retorna timestamp ISO 8601
  // Você pode usar NTP para sincronizar o tempo
  return "2025-01-17T01:00:00Z"; // Placeholder
}
```

### 6. Registrar Backup

```cpp
void registerBackup(String filename, float sizeMB, String type, String destination) {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_backups";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<512> doc;
  doc["device_id"] = deviceUUID;
  doc["filename"] = filename;
  doc["file_size_mb"] = sizeMB;
  doc["backup_type"] = type;
  doc["status"] = "completed";
  doc["destination"] = destination;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.POST(jsonBody);
  Serial.println("Backup registrado: " + String(httpCode));
  
  http.end();
}
```

### 7. Enviar Log

```cpp
void sendLog(String level, String message) {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_logs";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<512> doc;
  doc["device_id"] = deviceUUID;
  doc["log_level"] = level;
  doc["message"] = message;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  http.POST(jsonBody);
  http.end();
}

// Uso:
// sendLog("info", "Sistema iniciado");
// sendLog("warning", "Armazenamento baixo");
// sendLog("error", "Falha na transferência");
```

### 8. Loop Principal

```cpp
void loop() {
  // Verificar conexão WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Sua lógica de detecção USB e backup aqui
  
  // Exemplo: ao detectar novo arquivo
  if (newFileDetected()) {
    String filename = getFileName();
    float size = getFileSize();
    
    // Transferir arquivo
    bool success = transferFile(filename);
    
    if (success) {
      registerBackup(filename, size, "auto", "/backup");
      sendLog("info", "Backup de " + filename + " concluído");
    } else {
      sendLog("error", "Falha no backup de " + filename);
    }
  }
  
  delay(1000);
}
```

## Importante: Autenticação de Usuário

⚠️ **ATENÇÃO**: O código acima usa a `ANON_KEY` que tem permissões limitadas pelo RLS.

Para associar dispositivos a usuários, você tem duas opções:

### Opção 1: Sistema de Claim (Recomendado)
1. Dispositivo se registra sem user_id
2. Usuário faz "claim" do dispositivo via código único no dashboard
3. Sistema atualiza user_id no banco

### Opção 2: Autenticação no Dispositivo
1. Implementar fluxo OAuth no ESP32
2. Usuário faz login via display do dispositivo
3. Dispositivo obtém token de acesso
4. Usa token nas requisições

## Próximos Passos

1. ✅ Criar estrutura de banco de dados
2. ✅ Adaptar frontend para múltiplos dispositivos
3. 🔄 Implementar código ESP32
4. 🔄 Implementar sistema de claim/autenticação
5. 🔄 Testar comunicação end-to-end
6. 🔄 Adicionar criptografia TLS
7. 🔄 Implementar OTA updates

## Recursos Adicionais

- [Documentação Supabase REST API](https://supabase.com/docs/guides/api)
- [Arduino JSON Library](https://arduinojson.org/)
- [ESP32 HTTPClient](https://github.com/espressif/arduino-esp32/tree/master/libraries/HTTPClient)

## Suporte

Para dúvidas sobre a implementação, consulte a documentação do Supabase ou abra uma issue no repositório.
