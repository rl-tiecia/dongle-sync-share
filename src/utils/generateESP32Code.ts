interface ESP32Config {
  wifiSsid: string;
  wifiPassword: string;
  networkPath: string;
  username: string;
  password: string;
  checkInterval: number;
  deleteAfter: boolean;
  displayEnabled: boolean;
  claimCode: string;
}

const SUPABASE_URL = "https://eoqlgszxbiezdfmsakxq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWxnc3p4YmllemRmbXNha3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NjA0NTEsImV4cCI6MjA3NjIzNjQ1MX0.cV8Ks6pNJVeLx-4NkSbNyaEwuz_fPjM5SxUn7wHWsFA";

export function generateESP32Code(config: ESP32Config): string {
  return `/*
 * T-Dongle S3 - Firmware de Backup Automático
 * Gerado automaticamente via Dashboard
 * Claim Code: ${config.claimCode}
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <esp_system.h>

// ========== CONFIGURAÇÕES WiFi ==========
const char* WIFI_SSID = "${config.wifiSsid}";
const char* WIFI_PASSWORD = "${config.wifiPassword}";

// ========== CONFIGURAÇÕES DE REDE ==========
const char* NETWORK_PATH = "${config.networkPath}";
const char* NETWORK_USER = "${config.username}";
const char* NETWORK_PASSWORD = "${config.password}";

// ========== CONFIGURAÇÕES DO DISPOSITIVO ==========
const int CHECK_INTERVAL = ${config.checkInterval}; // segundos
const bool DELETE_AFTER_TRANSFER = ${config.deleteAfter ? 'true' : 'false'};
const bool DISPLAY_ENABLED = ${config.displayEnabled ? 'true' : 'false'};

// ========== CONFIGURAÇÕES SUPABASE ==========
const char* SUPABASE_URL = "${SUPABASE_URL}";
const char* SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const char* CLAIM_CODE = "${config.claimCode}";

// ========== VARIÁVEIS GLOBAIS ==========
String DEVICE_ID;
String deviceUUID;
String DEVICE_TOKEN;
bool isClaimed = false;
TFT_eSPI tft = TFT_eSPI();

// Status do dispositivo
bool wifiConnected = false;
bool usbHostActive = false;
bool transferActive = false;
int totalBackups = 0;
long storageUsedMB = 0;

// Controle de telas
int currentScreen = 0;
unsigned long lastDisplayUpdate = 0;

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  
  // Inicializar display
  if (DISPLAY_ENABLED) {
    tft.init();
    tft.setRotation(1);
    tft.fillScreen(TFT_BLACK);
  }
  
  // Gerar ID único do dispositivo
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  DEVICE_ID = "";
  for(int i = 0; i < 6; i++) {
    if (mac[i] < 16) DEVICE_ID += "0";
    DEVICE_ID += String(mac[i], HEX);
  }
  DEVICE_ID.toUpperCase();
  
  Serial.println("=================================");
  Serial.println("T-Dongle S3 - Sistema de Backup");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("Claim Code: " + String(CLAIM_CODE));
  Serial.println("=================================");
  
  // Conectar WiFi
  connectWiFi();
  
  // Registrar dispositivo
  registerDevice();
  
  // Verificar se já foi claimed
  checkClaimStatus();
  
  // Iniciar tarefas
  xTaskCreate(heartbeatTask, "Heartbeat", 8192, NULL, 1, NULL);
  xTaskCreate(displayTask, "Display", 4096, NULL, 1, NULL);
}

// ========== CONEXÃO WiFi ==========
void connectWiFi() {
  Serial.println("Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  wifiConnected = (WiFi.status() == WL_CONNECTED);
  
  if (wifiConnected) {
    Serial.println("\\nWiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("Sinal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\\nFalha ao conectar WiFi!");
  }
}

// ========== REGISTRO DO DISPOSITIVO ==========
bool registerDevice() {
  if (!wifiConnected) return false;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["device_name"] = "T-Dongle-" + DEVICE_ID.substring(0, 6);
  doc["mac_address"] = WiFi.macAddress();
  doc["firmware_version"] = "1.0.0";
  doc["is_online"] = true;
  doc["claim_code"] = CLAIM_CODE;
  doc["is_claimed"] = false;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("Registrando dispositivo...");
  int httpCode = http.POST(jsonBody);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Resposta registro: " + String(httpCode));
    
    if (httpCode == 201 || httpCode == 200) {
      StaticJsonDocument<1024> responseDoc;
      deserializeJson(responseDoc, response);
      
      if (responseDoc.is<JsonArray>()) {
        JsonArray arr = responseDoc.as<JsonArray>();
        if (arr.size() > 0) {
          deviceUUID = arr[0]["id"].as<String>();
          Serial.println("Device UUID: " + deviceUUID);
        }
      }
    }
  } else {
    Serial.println("Erro no registro: " + String(httpCode));
  }
  
  http.end();
  return httpCode == 201 || httpCode == 200;
}

// ========== VERIFICAR STATUS DE CLAIM ==========
void checkClaimStatus() {
  if (!wifiConnected || deviceUUID.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices?id=eq." + deviceUUID + "&select=device_token,is_claimed,user_id";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, response);
    
    if (doc.is<JsonArray>() && doc.as<JsonArray>().size() > 0) {
      JsonObject device = doc[0];
      
      if (!device["user_id"].isNull() && device["is_claimed"] == true) {
        isClaimed = true;
        DEVICE_TOKEN = device["device_token"].as<String>();
        Serial.println("✓ Dispositivo vinculado ao usuário!");
        Serial.println("Token obtido e salvo.");
        sendLog("info", "Dispositivo vinculado com sucesso");
      } else {
        Serial.println("Aguardando vinculação do usuário...");
        Serial.println("Exiba o código: " + String(CLAIM_CODE));
      }
    }
  }
  
  http.end();
}

// ========== HEARTBEAT TASK ==========
void heartbeatTask(void* parameter) {
  while (true) {
    // Verificar conexão WiFi
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      connectWiFi();
    } else {
      wifiConnected = true;
    }
    
    // Verificar se foi claimed
    if (!isClaimed) {
      checkClaimStatus();
    } else {
      updateDeviceStatus();
    }
    
    vTaskDelay(30000 / portTICK_PERIOD_MS); // A cada 30 segundos
  }
}

// ========== ATUALIZAR STATUS ==========
void updateDeviceStatus() {
  if (!wifiConnected || deviceUUID.isEmpty()) return;
  
  HTTPClient http;
  
  // 1. Atualizar last_seen no devices
  String deviceUrl = String(SUPABASE_URL) + "/rest/v1/devices?id=eq." + deviceUUID;
  http.begin(deviceUrl);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> deviceDoc;
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
  statusDoc["display_active"] = DISPLAY_ENABLED;
  statusDoc["wifi_connected"] = wifiConnected;
  statusDoc["usb_host_active"] = usbHostActive;
  statusDoc["transfer_active"] = transferActive;
  statusDoc["storage_used_mb"] = storageUsedMB;
  statusDoc["total_backups"] = totalBackups;
  
  String statusJson;
  serializeJson(statusDoc, statusJson);
  http.POST(statusJson);
  http.end();
}

// ========== ENVIAR LOG ==========
void sendLog(String level, String message) {
  if (!wifiConnected || deviceUUID.isEmpty()) return;
  
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

// ========== REGISTRAR BACKUP ==========
void registerBackup(String filename, float sizeMB, String destination) {
  if (!wifiConnected || deviceUUID.isEmpty()) return;
  
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
  doc["backup_type"] = "auto";
  doc["status"] = "completed";
  doc["destination"] = destination;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  http.POST(jsonBody);
  http.end();
  
  totalBackups++;
  storageUsedMB += (long)sizeMB;
}

// ========== DISPLAY TASK ==========
void displayTask(void* parameter) {
  while (DISPLAY_ENABLED) {
    if (millis() - lastDisplayUpdate > 5000) {
      if (!isClaimed) {
        displayClaimScreen();
      } else {
        switch(currentScreen) {
          case 0: displayStatusScreen(); break;
          case 1: displayTransferScreen(); break;
          case 2: displayStatsScreen(); break;
        }
        currentScreen = (currentScreen + 1) % 3;
      }
      lastDisplayUpdate = millis();
    }
    vTaskDelay(100 / portTICK_PERIOD_MS);
  }
  vTaskDelete(NULL);
}

// ========== TELAS DO DISPLAY ==========
void displayClaimScreen() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 20);
  tft.println("VINCULAR DISPOSITIVO");
  
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 50);
  tft.println("Acesse o painel web e");
  tft.setCursor(10, 65);
  tft.println("insira o código:");
  
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setTextSize(3);
  tft.setCursor(20, 90);
  tft.println(CLAIM_CODE);
  
  tft.setTextColor(TFT_GREEN, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 130);
  if (wifiConnected) {
    tft.print("WiFi: ");
    tft.println(WiFi.SSID());
  } else {
    tft.println("WiFi: Desconectado");
  }
}

void displayStatusScreen() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.println("STATUS");
  
  tft.setTextSize(1);
  int y = 40;
  
  // WiFi
  tft.setCursor(10, y);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.print("WiFi: ");
  if (wifiConnected) {
    tft.setTextColor(TFT_GREEN, TFT_BLACK);
    tft.print(WiFi.SSID());
    tft.print(" (");
    tft.print(WiFi.RSSI());
    tft.println(" dBm)");
  } else {
    tft.setTextColor(TFT_RED, TFT_BLACK);
    tft.println("Desconectado");
  }
  y += 15;
  
  // USB Host
  tft.setCursor(10, y);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.print("USB Host: ");
  tft.setTextColor(usbHostActive ? TFT_GREEN : TFT_YELLOW, TFT_BLACK);
  tft.println(usbHostActive ? "Detectado" : "Aguardando");
  y += 15;
  
  // IP
  if (wifiConnected) {
    tft.setCursor(10, y);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.print("IP: ");
    tft.setTextColor(TFT_CYAN, TFT_BLACK);
    tft.println(WiFi.localIP().toString());
  }
}

void displayTransferScreen() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.println("TRANSFERENCIA");
  
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setCursor(10, 50);
  
  if (transferActive) {
    tft.setTextColor(TFT_GREEN, TFT_BLACK);
    tft.println("Status: Em andamento");
    tft.setCursor(10, 70);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.println("Transferindo arquivo...");
    // Aqui você pode adicionar progresso
  } else {
    tft.setTextColor(TFT_YELLOW, TFT_BLACK);
    tft.println("Status: Aguardando");
    tft.setCursor(10, 70);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.println("Nenhuma transferência");
    tft.setCursor(10, 85);
    tft.println("em andamento");
  }
  
  tft.setCursor(10, 110);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.print("Destino: ");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.println(NETWORK_PATH);
}

void displayStatsScreen() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.println("ESTATISTICAS");
  
  tft.setTextSize(1);
  int y = 50;
  
  // Total de backups
  tft.setCursor(10, y);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.print("Total Backups: ");
  tft.setTextColor(TFT_GREEN, TFT_BLACK);
  tft.println(totalBackups);
  y += 20;
  
  // Armazenamento usado
  tft.setCursor(10, y);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.print("Armazenamento: ");
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  float gb = storageUsedMB / 1024.0;
  tft.print(gb, 2);
  tft.println(" GB");
  y += 20;
  
  // Device ID
  tft.setCursor(10, y);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.print("Device: ");
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.println(DEVICE_ID.substring(0, 8));
}

// ========== LOOP PRINCIPAL ==========
void loop() {
  // Aqui você adiciona sua lógica de:
  // - Detecção USB
  // - Leitura de arquivos
  // - Transferência para rede
  // - Gerenciamento de backups
  
  // Exemplo simplificado:
  // if (detectarNovoArquivo()) {
  //   transferActive = true;
  //   String filename = obterNomeArquivo();
  //   float size = obterTamanhoArquivo();
  //   
  //   if (transferirArquivo(filename)) {
  //     registerBackup(filename, size, NETWORK_PATH);
  //     sendLog("info", "Backup de " + filename + " concluído");
  //     
  //     if (DELETE_AFTER_TRANSFER) {
  //       deletarArquivo(filename);
  //     }
  //   } else {
  //     sendLog("error", "Falha no backup de " + filename);
  //   }
  //   
  //   transferActive = false;
  // }
  
  delay(CHECK_INTERVAL * 1000);
}
`;
}

export function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) code += '-'; // Formato: XXXX-XXXX
  }
  return code;
}
