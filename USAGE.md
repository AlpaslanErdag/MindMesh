# Kullanım Kılavuzu — Multi-Agent Platform

Bu doküman, platformun günlük kullanımını adım adım açıklar.

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Arayüz Bölümleri](#2-arayüz-bölümleri)
3. [İlk Task Oluşturma](#3-i̇lk-task-oluşturma)
4. [DAG Görselleştirmesi](#4-dag-görselleştirmesi)
5. [HITL Konsolu — İnsan Onayı](#5-hitl-konsolu--i̇nsan-onayı)
6. [Task Listesi ve Yönetim](#6-task-listesi-ve-yönetim)
7. [API ile Kullanım](#7-api-ile-kullanım)
8. [Agent Tipleri ve Görevleri](#8-agent-tipleri-ve-görevleri)
9. [LLM Değiştirme](#9-llm-değiştirme)
10. [Sık Karşılaşılan Durumlar](#10-sık-karşılaşılan-durumlar)

---

## 1. Genel Bakış

Platform, karmaşık bir hedefi alır ve bunu birden fazla uzman agent aracılığıyla otomatik olarak çözer.

```
Kullanıcı → Hedef Girer → Orchestrator → Planner → Researcher / Coder / Critic
                                                              ↓
                                          Sonuç ← HITL Onayı (gerekirse)
```

**Temel akış:**

1. Kullanıcı yüksek seviyeli bir hedef (objective) girer.
2. **Planner** agent hedefi adımlara böler ve bir DAG (yönlü asiklik graf) oluşturur.
3. Her adım uygun agent'a devredilir (Researcher, Coder, Critic).
4. Düşük güvenilirlikli veya riskli aksiyonlar **HITL kuyruğuna** düşer.
5. Sonuçlar gerçek zamanlı olarak arayüzde yansır.

---

## 2. Arayüz Bölümleri

```
┌─────────────────────────────────────────────────────┐
│  Sidebar          │  Ana İçerik                     │
│                   │                                 │
│  ● Dashboard      │  Seçili sayfanın içeriği        │
│  ● Tasks          │                                 │
│  ● HITL Console   │                                 │
│                   │                                 │
│  [System Active]  │             [Live / Disconnected]│
└─────────────────────────────────────────────────────┘
```

| Sayfa | Adres | Amaç |
|-------|-------|------|
| Dashboard | `http://localhost:3000/` | Task gönder, DAG izle, canlı event akışı |
| Tasks | `http://localhost:3000/tasks` | Tüm task'ları listele, iptal et |
| HITL Console | `http://localhost:3000/hitl` | İnsan onay kuyruğu |

**Bağlantı göstergesi** (sağ üst köşe):
- 🟢 **Live** — WebSocket bağlı, olaylar gerçek zamanlı geliyor.
- 🔴 **Disconnected** — Backend'e bağlanılamıyor. Backend'in çalıştığını kontrol edin.

---

## 3. İlk Task Oluşturma

**Dashboard** sayfasındaki **"New Task"** formunu kullanın.

### Alanlar

| Alan | Açıklama | Örnek |
|------|----------|-------|
| **Objective** | Agent'lara verilecek hedef. En az 10 karakter. | `"Explain quantum computing and write a Python simulation"` |
| **Priority** | `Low / Medium / High / Critical` | `High` |
| **Tags** | Opsiyonel etiketler. Enter veya + ile ekleyin. | `research`, `python` |

### Adımlar

1. **Objective** alanına hedefinizi yazın.
2. **Priority** seçin.
3. Varsa **Tags** ekleyin.
4. **Submit Task** butonuna tıklayın.

Task gönderildiği anda:
- Sağ alt köşede `"Task submitted — agents are planning..."` bildirimi görünür.
- DAG paneli canlı olarak güncellenir.
- **Live Event Feed** panelinde olaylar akmaya başlar.

### İyi Objective Örnekleri

```
✅ "Research the top 5 Python web frameworks in 2025 and compare their performance"
✅ "Write a Python function that parses JSON and validates email addresses, then test it"
✅ "Analyze the pros and cons of microservices vs monolithic architecture"

❌ "Do something"           → çok kısa, agent'lar ne yapacağını bilemez
❌ "Write code"             → hedef belirsiz
```

---

## 4. DAG Görselleştirmesi

Task başladıktan sonra **Dashboard**'un sağ tarafında DAG paneli açılır.

### Düğüm Renkleri

| Renk | Durum | Anlam |
|------|-------|-------|
| ⬜ Gri kenarlık | `pending` | Henüz başlamadı |
| 🔵 Mavi kenarlık | `running` | Şu an çalışıyor |
| 🟢 Yeşil kenarlık | `completed` | Başarıyla tamamlandı |
| 🔴 Kırmızı kenarlık | `failed` | Hata ile sonlandı |
| 🟡 Sarı kenarlık | `waiting_hitl` | İnsan onayı bekliyor |

### Düğüm Tipi Renkleri (sol kenar çizgisi)

| Renk | Agent Tipi |
|------|-----------|
| Mor | Planner |
| Mavi | Researcher |
| Yeşil | Coder |
| Turuncu | Critic |

### DAG Kontrolleri

- **Scroll** — yakınlaştır/uzaklaştır
- **Sürükle** — grafiği kaydır
- **MiniMap** (sağ alt) — genel bakış
- **Kontrol butonları** (sol alt) — fit-to-view, zoom

### Güven Çubuğu (Confidence Bar)

Her agent kartında mavi bir çubuk görünür. Bu, agent'ın kendi çıktısından ne kadar emin olduğunu gösterir:

- **%75 üzeri** → otomatik devam eder
- **%75 altı** → HITL kuyruğuna düşer, insan onayı gerekir

---

## 5. HITL Konsolu — İnsan Onayı

**Human-in-the-Loop (HITL)**: Agent'lar düşük güvenilirlikle veya riskli bir aksiyon yapmak istediğinde otomatik olarak durur ve insan onayı bekler.

### HITL Kuyruğuna Düşme Durumları

- Kod çalıştırma isteği (güven < %75)
- Sistem dosyasına yazma
- Dış API çağrısı (yüksek güven eşiği gerektiren)

### İnceleme Adımları

1. **HITL Console** (`/hitl`) sayfasına gidin.
2. Bekleyen review kartlarını görürsünüz.
3. Her kartta:
   - **Action** — agent'ın yapmak istediği işlem
   - **Agent ID** — hangi agent bekliyor
   - **Confidence** — güven skoru
   - **Reason** — neden onay gerektiği
   - **Show payload** → `execute_code` için kodu görmek üzere tıklayın

4. Kodu/aksiyonu inceleyin.
5. Opsiyonel olarak **reviewer notes** alanına notunuzu yazın.
6. **Approve** veya **Reject** butonuna tıklayın.

### Onay / Red Sonrası

- **Approve** → Agent kaldığı yerden devam eder.
- **Reject** → Agent durur, task `failed` olarak işaretlenir.

> ⚠️ Bir review kuyruğa düştüğünde Dashboard'da sarı bir toast bildirimi görünür: `"Human review required for coder-1"`

---

## 6. Task Listesi ve Yönetim

**Tasks** sayfası (`/tasks`) tüm task'ların geçmişini gösterir.

### Task Durumları

| Durum | Açıklama |
|-------|----------|
| `pending` | Kuyruğa alındı, henüz başlamadı |
| `planning` | Planner agent çalışıyor |
| `running` | Agent'lar görev yapıyor |
| `waiting_hitl` | İnsan onayı bekleniyor |
| `completed` | Başarıyla tamamlandı |
| `failed` | Hata oluştu |
| `cancelled` | Kullanıcı tarafından iptal edildi |

### Task İptal Etme

Durumu `pending`, `planning` veya `running` olan task'larda ❌ ikonu görünür. Tıklandığında task iptal edilir.

### Yenileme

**Refresh** butonuna tıklayarak listeyi güncelleyin. WebSocket bağlıyken durum değişimleri otomatik yansır.

---

## 7. API ile Kullanım

Backend `http://localhost:8065/docs` adresinde interaktif Swagger dokümantasyonu sunar.

### Task Oluştur

```bash
curl -X POST http://localhost:8065/api/v1/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "Research the history of artificial intelligence",
    "priority": "medium",
    "tags": ["research", "ai"]
  }'
```

**Yanıt:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "objective": "Research the history of artificial intelligence",
  ...
}
```

### Task Durumu Sorgula

```bash
curl http://localhost:8065/api/v1/tasks/{task_id}
```

### HITL Kuyruğunu Sorgula

```bash
curl http://localhost:8065/api/v1/hitl/queue
```

### HITL Kararı Ver

```bash
curl -X POST http://localhost:8065/api/v1/hitl/{review_id}/decide \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewer_notes": "Code looks safe to execute."
  }'
```

### WebSocket Bağlantısı (örnek — Python)

```python
import asyncio
import websockets
import json

async def listen():
    uri = "ws://localhost:8065/ws/my-client-id"
    async with websockets.connect(uri) as ws:
        async for message in ws:
            event = json.loads(message)
            print(f"[{event['event']}] {event.get('message', '')}")

asyncio.run(listen())
```

---

## 8. Agent Tipleri ve Görevleri

| Agent | Renk | Yaptığı İş | İzinler |
|-------|------|-----------|---------|
| **Planner** | Mor | Hedefi adımlara böler, DAG oluşturur | Okuma |
| **Researcher** | Mavi | Web araması yapar, bilgi derler, özetler | Okuma, Ağ |
| **Coder** | Yeşil | Python kodu yazar, (onay varsa) çalıştırır | Okuma, Çalıştırma |
| **Critic** | Turuncu | Diğer agent çıktılarını puanlar, eksikleri raporlar | Okuma |

### Akış Örneği

```
Hedef: "Write and test a Python function to calculate fibonacci numbers"

Planner → Plan:
  Step 1 (researcher): Research fibonacci algorithms
  Step 2 (coder):      Write fibonacci function [depends: step 1]
  Step 3 (critic):     Review the code [depends: step 1, 2]

Execution DAG:
  researcher-1 ──→ coder-2 ──→ critic-3
```

---

## 9. LLM Değiştirme

`.env` dosyasındaki şu satırları düzenleyin ve backend'i yeniden başlatın:

### Mevcut Ollama Modellerinden Birini Kullanmak

```env
LLM_PROVIDER=openai
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1:8b      # veya mistral:7b, gemma3:4b, vb.
LLM_API_KEY=ollama
```

### Kullanılabilir Modeller (sisteminizde kurulu)

```bash
ollama list
```

Önerilen modeller (hız/kalite dengesi):

| Model | Boyut | Öneri |
|-------|-------|-------|
| `llama3.1:8b` | 4.9 GB | ✅ Genel amaç (varsayılan) |
| `mistral:7b` | 4.4 GB | ✅ Hızlı, kod için iyi |
| `gemma3:4b` | 3.3 GB | ⚡ En hızlı |
| `gemma3:12b` | 8.1 GB | 🎯 Daha kaliteli çıktı |
| `granite3.3:8b` | 4.9 GB | 🔧 Kod odaklı |

### OpenAI API Kullanmak

```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
LLM_API_KEY=sk-...
```

Backend'i yeniden başlatın:

```bash
# Ctrl+C ile durdurup
uv run uvicorn app.main:app --reload --port 8065
```

---

## 10. Sık Karşılaşılan Durumlar

### "Disconnected" göstergesi görünüyor

Backend çalışmıyor. Kontrol edin:

```bash
curl http://localhost:8065/health
# Beklenen: {"status": "ok"}
```

### Task `planning` aşamasında takılı kalıyor

Ollama'nın çalıştığını doğrulayın:

```bash
curl http://localhost:11434/api/tags
```

### Task `failed` oluyor

Veritabanı servislerini kontrol edin:

```bash
docker compose ps
# postgres, qdrant, redis → "healthy" olmalı
```

Sağlıklı değillerse:

```bash
docker compose up -d postgres qdrant redis
```

### HITL kuyruğunda bir review takılı kaldı

API üzerinden manuel karar verin:

```bash
# Önce ID'yi al
curl http://localhost:8065/api/v1/hitl/queue

# Karar ver
curl -X POST http://localhost:8065/api/v1/hitl/{review_id}/decide \
  -H "Content-Type: application/json" \
  -d '{"approved": false, "reviewer_notes": "Rejected manually"}'
```

### Kod çalıştırma her zaman HITL'e düşüyor

`HITL_CONFIDENCE_THRESHOLD` değerini `.env`'de düşürün (varsayılan `0.75`):

```env
HITL_CONFIDENCE_THRESHOLD=0.5
```

---

## Hızlı Referans

```
Frontend    → http://localhost:3000
API Docs    → http://localhost:8065/docs
Qdrant UI   → http://localhost:6333/dashboard
Health      → http://localhost:8065/health

Backend başlat  → uv run uvicorn app.main:app --reload --port 8065
Frontend başlat → npm run dev  (frontend/ klasöründe)
DB servisleri   → docker compose up -d postgres qdrant redis
Logları izle    → docker compose logs -f
```
