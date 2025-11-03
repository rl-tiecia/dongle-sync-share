interface ESP32Config {
  wifiSsid: string;
  wifiPassword: string;
  networkPath: string;
  username: string;
  password: string;
  checkInterval: number;
  deleteAfter: boolean;
  displayEnabled: boolean;
  // claimCode removido - dispositivo usa MAC address como identificador único
}

const SUPABASE_URL = "https://eoqlgszxbiezdfmsakxq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWxnc3p4YmllemRmbXNha3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NjA0NTEsImV4cCI6MjA3NjIzNjQ1MX0.cV8Ks6pNJVeLx-4NkSbNyaEwuz_fPjM5SxUn7wHWsFA";

export function generateESP32Code(config: ESP32Config): string {
  return `/*
 * ============================================
 * T-Dongle S3 - Firmware de Backup Automático
 * ============================================
 * 
 * CONFIGURAÇÃO NO ARDUINO IDE:
 * 
 * 1. Placa: "ESP32S3 Dev Module"
 * 2. Upload Speed: "921600"
 * 3. USB Mode: "Hardware CDC and JTAG"
 * 4. USB CDC On Boot: "Enabled"
 * 5. USB Firmware MSC On Boot: "Disabled"
 * 6. USB DFU On Boot: "Disabled"
 * 7. Upload Mode: "UART0 / Hardware CDC"
 * 8. CPU Frequency: "240MHz (WiFi)"
 * 9. Flash Mode: "QIO 80MHz"
 * 10. Flash Size: "4MB (32Mb)"
 * 11. Partition Scheme: "Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)"
 * 12. Core Debug Level: "None" (ou "Info" para debug)
 * 13. PSRAM: "Disabled" (a menos que seu T-Dongle tenha PSRAM)
 * 14. Events Run On: "Core 1"
 * 15. Arduino Runs On: "Core 1"
 * 
 * BIBLIOTECAS NECESSÁRIAS:
 * - TFT_eSPI (by Bodmer) - versão 2.5.0 ou superior
 * - ArduinoJson - versão 6.21.0 ou superior
 * 
 * PINOS DO T-DONGLE-S3:
 * Os pinos estão configurados abaixo. Se o display não funcionar:
 * 1. Verifique o esquemático oficial: https://github.com/Xinyuan-LilyGO/T-Dongle-S3
 * 2. Ajuste os valores de TFT_MOSI, TFT_SCLK, etc.
 * 
 * TROUBLESHOOTING:
 * - Boot loop infinito: Verifique os pinos do display
 * - Tela preta: Verifique TFT_BL (backlight) e TFT_RGB_ORDER
 * - Não compila: Instale as bibliotecas necessárias
 * - WiFi não conecta: Verifique SSID e senha
 * 
 * Gerado automaticamente via Dashboard
 * Claim Code: MAC address do dispositivo
 */

// ========== DEBUG MODE ==========
// Descomente esta linha para desabilitar display durante debug
// #define DEBUG_MODE_NO_DISPLAY

// ========== CONFIGURAÇÃO DO DISPLAY ST7735 ==========
// IMPORTANTE: Estes pinos são para o T-Dongle-S3
// Verifique o esquemático do seu dispositivo se houver problemas

#define USER_SETUP_LOADED 1

// Driver do display
#define ST7735_DRIVER

// Pinos SPI do T-Dongle-S3 (ESP32-S3)
#define TFT_MOSI 3    // Verifique esquemático
#define TFT_SCLK 2    // Verifique esquemático  
#define TFT_CS   4    // Chip Select
#define TFT_DC   5    // Data/Command
#define TFT_RST  1    // Reset (-1 se conectado ao RST do ESP)
#define TFT_BL   38   // Backlight

// Configuração do backlight
#define TFT_BACKLIGHT_ON HIGH

// Dimensões do display
#define TFT_WIDTH  80
#define TFT_HEIGHT 160

// Ordem de cores (pode ser TFT_RGB ou TFT_BGR)
#define TFT_RGB_ORDER TFT_BGR

// Fontes
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_GFXFF
#define SMOOTH_FONT

// Frequências SPI
#define SPI_FREQUENCY  27000000
#define SPI_READ_FREQUENCY  20000000

// CRÍTICO para ESP32-S3: usar porta HSPI
#define USE_HSPI_PORT

// ========== BIBLIOTECAS ==========
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

#ifdef DEBUG_MODE_NO_DISPLAY
  const bool DISPLAY_ENABLED = false;
#else
  const bool DISPLAY_ENABLED = ${config.displayEnabled ? 'true' : 'false'};
#endif

// ========== CONFIGURAÇÕES SUPABASE ==========
const char* SUPABASE_URL = "${SUPABASE_URL}";

// ========== VARIÁVEIS GLOBAIS ==========
String DEVICE_ID;
String deviceUUID;
String DEVICE_TOKEN;
bool isClaimed = false;
#include <Preferences.h>
Preferences preferences;
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
  delay(1000); // Dar tempo para ESP32-S3 estabilizar
  
  Serial.println("\\n\\n=================================");
  Serial.println("T-Dongle S3 - Sistema de Backup");
  Serial.println("Inicializando...");
  
  // Inicializar display COM TRATAMENTO DE ERRO
  if (DISPLAY_ENABLED) {
    Serial.println("Inicializando display...");
    
    // Ativar backlight primeiro
    pinMode(TFT_BL, OUTPUT);
    digitalWrite(TFT_BL, HIGH);
    
    delay(100); // Delay antes de inicializar TFT
    
    tft.init();
    tft.setRotation(1); // Landscape
    tft.fillScreen(TFT_BLACK);
    
    // Teste básico
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.setCursor(5, 5);
    tft.setTextSize(1);
    tft.println("Display OK");
    
    Serial.println("Display inicializado!");
  }
  
  delay(500); // Delay antes de WiFi
  
  // Gerar ID único do dispositivo (MAC Address)
  String macStr = WiFi.macAddress();
  macStr.replace(":", "");
  DEVICE_ID = macStr;
  DEVICE_ID.toUpperCase();
  
  Serial.println("=================================");
  Serial.println("Device ID (MAC): " + DEVICE_ID);
  Serial.println("Claim Code (MAC): " + DEVICE_ID);
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

// ========== REGISTRO DO DISPOSITIVO (via Edge Function) ==========
bool registerDevice() {
  if (!wifiConnected) return false;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/device-register";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["mac_address"] = DEVICE_ID;
  doc["firmware_version"] = "1.0.0";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("Registrando dispositivo via Edge Function...");
  int httpCode = http.POST(jsonBody);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Resposta: " + response);
    
    StaticJsonDocument<512> responseDoc;
    deserializeJson(responseDoc, response);
    
    deviceUUID = responseDoc["device_uuid"].as<String>();
    Serial.println("Device UUID: " + deviceUUID);
    
    http.end();
    return true;
  } else {
    Serial.println("Erro: " + String(httpCode));
    http.end();
    return false;
  }
}

// ========== VERIFICAR STATUS DE CLAIM (via Edge Function) ==========
void checkClaimStatus() {
  if (!wifiConnected || DEVICE_ID.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/device-heartbeat?action=check-claim&device_id=" + DEVICE_ID;
  
  http.begin(url);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);
    
    if (doc["claimed"] == true && !doc["token"].isNull()) {
      isClaimed = true;
      DEVICE_TOKEN = doc["token"].as<String>();
      
      // Salvar token na EEPROM/Preferences
      preferences.begin("device", false);
      preferences.putString("token", DEVICE_TOKEN);
      preferences.end();
      
      Serial.println("✓ Dispositivo vinculado! Token salvo.");
      sendLog("info", "Dispositivo vinculado com sucesso");
    }
  }
  
  http.end();
}

// ========== HEARTBEAT TASK ==========
void heartbeatTask(void* parameter) {
  while (true) {
    // Feed watchdog
    vTaskDelay(10 / portTICK_PERIOD_MS);
    
    // Verificar conexão WiFi
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      Serial.println("WiFi desconectado, reconectando...");
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

// ========== ATUALIZAR STATUS (via Edge Function) ==========
void updateDeviceStatus() {
  if (!wifiConnected || DEVICE_TOKEN.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/device-heartbeat?action=status";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-ID", DEVICE_ID);
  
  StaticJsonDocument<512> doc;
  doc["display_active"] = DISPLAY_ENABLED;
  doc["wifi_connected"] = wifiConnected;
  doc["usb_host_active"] = usbHostActive;
  doc["transfer_active"] = transferActive;
  doc["storage_used_mb"] = storageUsedMB;
  doc["total_backups"] = totalBackups;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  http.POST(jsonBody);
  http.end();
}

// ========== ENVIAR LOG (via Edge Function) ==========
void sendLog(String level, String message) {
  if (!wifiConnected || DEVICE_TOKEN.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/device-heartbeat?action=log";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-ID", DEVICE_ID);
  
  StaticJsonDocument<512> doc;
  doc["log_level"] = level;
  doc["message"] = message;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  http.POST(jsonBody);
  http.end();
}

// ========== REGISTRAR BACKUP (via Edge Function) ==========
void registerBackup(String filename, float sizeMB, String destination) {
  if (!wifiConnected || DEVICE_TOKEN.isEmpty()) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/device-heartbeat?action=backup";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-ID", DEVICE_ID);
  
  StaticJsonDocument<512> doc;
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
    // Feed watchdog
    vTaskDelay(10 / portTICK_PERIOD_MS);
    
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
  tft.setTextSize(2);
  tft.setCursor(10, 90);
  tft.println(DEVICE_ID);
  
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
