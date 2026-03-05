import { LEDGER_BASE } from "../api.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes) {
  if (!bytes) return "-";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export async function renderUpload() {
  return `
  <div class="upload-container">
    <h2 class="upload-title">영수증 업로드</h2>

    <div class="upload-layout">
      <div class="upload-box">
        <label class="drop-zone" id="dropZone">
          <input type="file" id="receiptFile" accept="image/*" hidden />

          <div class="drop-content" id="dropContent">
            <div class="upload-icon">📄</div>
            <p>이미지를 드래그하거나 클릭해 업로드하세요.</p>
            <small>JPG / PNG (최대 10MB)</small>
          </div>

          <img id="previewImage" class="preview hidden" alt="영수증 미리보기" />
        </label>

        <button id="uploadBtn" class="upload-btn" disabled>업로드</button>
        <p id="uploadStatus" class="upload-status"></p>

        <div class="upload-meta">
          <div class="meta-row">
            <span>선택 파일</span>
            <b id="selectedFileName">없음</b>
          </div>
          <div class="meta-row">
            <span>파일 크기</span>
            <b id="selectedFileSize">-</b>
          </div>
        </div>

        <div class="upload-guide">
          <h4>업로드 팁</h4>
          <ul class="upload-tips">
            <li>영수증 전체가 한 장에 나오도록 촬영해 주세요.</li>
            <li>반사광, 그림자를 줄이면 OCR 정확도가 올라갑니다.</li>
            <li>거래일과 금액이 흐리면 분석 누락이 생길 수 있습니다.</li>
          </ul>
        </div>
      </div>

      <div id="uploadResult" class="result-card">
        <h3>영수증 분석</h3>
        <div class="result-empty">
          <div class="empty-icon">🧾</div>
          <p>
            영수증 또는 결제 문자 이미지를 업로드하면<br>
            자동으로 금액과 카테고리를 분석합니다.
          </p>
        </div>
        <div class="result-empty-foot">
          <div class="format-chips">
            <span>JPG</span>
            <span>PNG</span>
            <span>이미지 전용</span>
          </div>
          <p class="result-note">거래 데이터 CSV 다운로드는 설정 탭에서 할 수 있습니다.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

export async function afterRenderUpload() {
  const dropZone = document.getElementById("dropZone");
  const dropContent = document.getElementById("dropContent");
  const fileInput = document.getElementById("receiptFile");
  const preview = document.getElementById("previewImage");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("uploadStatus");
  const resultBox = document.getElementById("uploadResult");
  const selectedFileNameEl = document.getElementById("selectedFileName");
  const selectedFileSizeEl = document.getElementById("selectedFileSize");

  let selectedFile = null;
  let previewURL = null;

  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      status.innerText = "이미지 파일만 업로드할 수 있습니다.";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      status.innerText = "파일 크기는 10MB 이하만 가능합니다.";
      return;
    }

    selectedFile = file;

    if (previewURL) {
      URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);
    preview.src = previewURL;
    preview.classList.remove("hidden");
    dropContent.style.display = "none";

    uploadBtn.disabled = false;
    status.innerText = "파일 선택됨";
    selectedFileNameEl.textContent = file.name;
    selectedFileSizeEl.textContent = formatFileSize(file.size);
  }

  fileInput.addEventListener("change", () => {
    handleFile(fileInput.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
    handleFile(e.dataTransfer.files[0]);
  });

  uploadBtn.addEventListener("click", async () => {
    if (!selectedFile) {
      alert("파일을 먼저 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    uploadBtn.disabled = true;
    uploadBtn.innerText = "분석 중...";
    status.innerText = "AI 분석 중...";

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${LEDGER_BASE}/receipts/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "업로드 실패");
      }

      status.innerText = "업로드 성공";

      resultBox.innerHTML = `
        <h3>분석 결과</h3>
        <img src="${previewURL}" class="result-preview" alt="분석 이미지" />
        <div class="result-info">
          <div>
            <span>상호명</span>
            <strong>${data.merchant_name || "-"}</strong>
          </div>
          <div>
            <span>금액</span>
            <strong>${data.amount ? `${Number(data.amount).toLocaleString()} 원` : "-"}</strong>
          </div>
          <div>
            <span>카테고리</span>
            <strong>${data.category || "-"}</strong>
          </div>
        </div>
      `;
      resultBox.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      status.innerText = err?.message || "서버 오류";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerText = "업로드";
    }
  });
}
