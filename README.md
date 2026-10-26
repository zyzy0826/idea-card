# ✨ 靈感抽卡

給社課學員抽取自走棋遊戲機制點子的小網頁。抽一張靈感卡，按「就決定是它了！」，補充自己的想法後一鍵複製 prompt，貼給 AI Agent 使用。

純靜態網站（HTML / CSS / JS），不需要後端，也不需要 build。

## 檔案結構

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面結構 |
| `style.css` | 樣式與動畫 |
| `app.js` | 抽卡、圖鑑、複製 prompt 的邏輯 |
| `cards.json` | **卡片資料，改內容只要改這個檔案** |

## 編輯卡片

`cards.json` 是一個陣列，每張卡片的格式如下：

```json
{
  "id": "venom-arrow",
  "emoji": "🏹",
  "name": "淬毒箭",
  "school": "劇毒",
  "rarity": "★",
  "description": "給學員看的機制說明",
  "hint": "在 on_attack 裡呼叫 poison(target, amount, turns)",
  "prompt": "決定後要複製給 Agent 的內容"
}
```

- `id` 不能重複。學員目前抽到的卡是用 `id` 記在瀏覽器裡的，改掉的話，原本抽到那張的學員重新整理後會回到卡背
- `school` 填自走棋的流派：`劇毒`、`聖盾`、`狂血`、`死靈`。篩選按鈕和圖鑑分組會自動依照出現的流派產生
- `hint` 和 `prompt` 只能用框架真的有的事件和 API（`on_battle_start`、`on_attack`、`on_hurt`、`on_death`、`on_ally_death`；`deal_damage`、`poison`、`shield`、`drain`、`curse`……），寫不存在的東西學員的 AI 會做不出來
- `rarity` 只能填 `★`、`★★`、`★★★`（普通 / 稀有 / 傳說）
- 存檔前可以先用 [JSONLint](https://jsonlint.com/) 檢查格式，少一個逗號整個網頁都會讀不到資料

複製出去的 prompt 開頭那句話寫在 `app.js` 最上面的 `PROMPT_HEADER`。

## 本機測試

> ⚠️ 直接在檔案總管雙擊 `index.html` 開啟的話，網址會是 `file:///...`。瀏覽器基於安全限制會擋住 `fetch('cards.json')`，畫面會顯示「讀不到卡片資料」。

本機測試時要用一個簡單的本機伺服器開啟，任選一種方式：

**Python（電腦有裝 Python 的話）**

```bash
cd 專案資料夾
python -m http.server 8000
```

然後用瀏覽器打開 <http://localhost:8000>。

**Node.js**

```bash
npx serve .
```

**VS Code**

安裝「Live Server」擴充功能，在 `index.html` 上按右鍵 →「Open with Live Server」。

### 用手機測試

電腦和手機連同一個 Wi-Fi，用上面的 Python 指令啟動伺服器，手機瀏覽器打開 `http://<電腦的區網 IP>:8000`（Windows 可以用 `ipconfig` 查 IPv4 位址）。

注意：用區網 IP 開啟時不是 HTTPS，部分手機瀏覽器會拒絕自動複製，網頁會改成選取文字讓你手動複製。部署到 GitHub Pages（HTTPS）之後就能正常一鍵複製。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的 repository（例如 `idea-card`），設成 **Public**。免費方案的私人 repo 不能用 Pages
2. 把本機的專案推上去：

   ```bash
   git remote add origin https://github.com/<你的帳號>/idea-card.git
   git push -u origin main
   ```

3. 到 repository 的 **Settings → Pages**
4. **Source** 選 **Deploy from a branch**，**Branch** 選 `main`、資料夾選 `/ (root)`，按 **Save**
5. 等一到兩分鐘，頁面上方會出現網址，通常是：

   ```
   https://<你的帳號>.github.io/idea-card/
   ```

之後只要修改檔案（例如 `cards.json`）並 `git push`，GitHub Pages 會自動重新部署，大約一分鐘後生效。如果學員看到的還是舊內容，請他們重新整理（手機可以下拉重新整理）。

## 其他說明

- 抽卡沒有次數限制；連續抽卡時，只要卡池大於 1 張，就不會連續抽到同一張
- 學員目前抽到的卡存在瀏覽器的 localStorage，重新整理不會消失。無痕模式關閉後會清掉
- 圖鑑分頁可以直接點任何一張卡，進入「就決定是它了！」的流程
