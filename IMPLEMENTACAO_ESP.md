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

## Importante: Autenticação de Usuário e Segurança

⚠️ **ATENÇÃO CRÍTICA DE SEGURANÇA**: 

### Problema de Segurança Atual
O código acima usa a `ANON_KEY` hardcoded no firmware do ESP32, o que cria uma **vulnerabilidade crítica de segurança**:
- Qualquer pessoa com acesso ao firmware pode extrair a chave
- Atacantes podem se passar por dispositivos legítimos
- Dados falsos podem ser injetados para qualquer usuário
- Não há autenticação real ao nível do dispositivo

### ⚠️ NÃO USE EM PRODUÇÃO SEM IMPLEMENTAR UMA DAS SOLUÇÕES ABAIXO

### Opção 1: Sistema de Claim com Device Token (RECOMENDADO)

Esta é a solução mais segura e escalável:

1. **Geração de Claim Code (Durante Fabricação/Setup)**
```cpp
// Gerar código único de 8 caracteres alfanuméricos
String generateClaimCode() {
  const char charset[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  String code = "";
  for(int i = 0; i < 8; i++) {
    code += charset[esp_random() % (sizeof(charset) - 1)];
  }
  return code;
}

String CLAIM_CODE = generateClaimCode(); // Ex: "A3K9P2X7"
// Este código deve ser exibido no display do dispositivo ou impresso em etiqueta
```

2. **Registro Inicial sem user_id**
```cpp
bool registerDevice() {
  // Dispositivo se registra sem user_id (null)
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["device_name"] = "T-Dongle-" + DEVICE_ID.substring(0, 6);
  doc["mac_address"] = WiFi.macAddress();
  doc["firmware_version"] = "1.0.0";
  doc["claim_code"] = CLAIM_CODE; // Armazenar claim code
  doc["is_claimed"] = false;
  // user_id será null até o claim
}
```

3. **Usuário Faz Claim via Dashboard**
O usuário digita o código exibido no dispositivo. Backend valida e associa:
```sql
-- Edge Function ou RPC para validar claim
CREATE OR REPLACE FUNCTION claim_device(p_claim_code TEXT)
RETURNS json AS $$
DECLARE
  v_device_id UUID;
  v_device_token TEXT;
BEGIN
  -- Validar claim code
  SELECT id INTO v_device_id 
  FROM devices 
  WHERE claim_code = p_claim_code 
    AND is_claimed = false 
    AND user_id IS NULL;
  
  IF v_device_id IS NULL THEN
    RETURN json_build_object('error', 'Código inválido ou já utilizado');
  END IF;
  
  -- Gerar token único para o dispositivo
  v_device_token := encode(gen_random_bytes(32), 'base64');
  
  -- Associar ao usuário atual
  UPDATE devices 
  SET user_id = auth.uid(),
      is_claimed = true,
      device_token = v_device_token,
      claimed_at = now()
  WHERE id = v_device_id;
  
  RETURN json_build_object(
    'success', true, 
    'device_id', v_device_id,
    'device_token', v_device_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

4. **Dispositivo Recebe Token Exclusivo**
```cpp
void checkClaimStatus() {
  // Periodicamente verificar se foi claimed
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices?device_id=eq." + DEVICE_ID + "&select=device_token,is_claimed";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);
    
    if (doc[0]["is_claimed"] == true) {
      DEVICE_TOKEN = doc[0]["device_token"].as<String>();
      // Salvar token na EEPROM/Flash
      saveTokenToFlash(DEVICE_TOKEN);
      Serial.println("Dispositivo vinculado! Token obtido.");
    }
  }
  http.end();
}
```

5. **Usar Token em Todas as Requisições Futuras**
```cpp
void updateDeviceStatus() {
  if (DEVICE_TOKEN.isEmpty()) {
    checkClaimStatus(); // Ainda não claimed
    return;
  }
  
  HTTPClient http;
  http.begin(url);
  // Usar device token ao invés de anon key
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("X-Device-ID", DEVICE_ID);
  // ...
}
```

### Opção 2: Edge Function com Validação HMAC

Criar Edge Function que valida assinaturas criptográficas:

```typescript
// Edge Function: verify-device-request
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

Deno.serve(async (req) => {
  const { device_id, mac_address, timestamp, signature, data } = await req.json()
  
  // Buscar secret do dispositivo
  const supabase = createClient(...)
  const { data: device } = await supabase
    .from('devices')
    .select('device_secret, user_id')
    .eq('device_id', device_id)
    .single()
  
  // Validar HMAC signature
  const payload = `${device_id}:${mac_address}:${timestamp}`
  const expectedSignature = createHmac('sha256', device.device_secret)
    .update(payload)
    .digest('hex')
  
  if (signature !== expectedSignature) {
    return new Response('Invalid signature', { status: 401 })
  }
  
  // Validar timestamp (prevenir replay attacks)
  if (Math.abs(Date.now() - timestamp) > 60000) { // 1 minuto
    return new Response('Request expired', { status: 401 })
  }
  
  // Processar dados autenticados
  // ...
})
```

### Migração de Banco Necessária

Adicionar colunas de segurança à tabela devices:

```sql
ALTER TABLE devices 
ADD COLUMN claim_code TEXT UNIQUE,
ADD COLUMN is_claimed BOOLEAN DEFAULT false,
ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN device_token TEXT UNIQUE,
ADD COLUMN device_secret TEXT; -- Para HMAC
```

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
