/* ========================================
   RENDER
======================================== */

export async function renderUpload() {
  return `
  <div class="upload-container">

    <h2 class="upload-title">영수증 업로드</h2>

    <div class="upload-layout">

      <!-- 업로드 영역 -->
      <div class="upload-box">

        <label class="drop-zone" id="dropZone">
          <input type="file" id="receiptFile" accept="image/*" hidden />

          <div class="drop-content" id="dropContent">
            <div class="upload-icon">📄</div>
            <p>이미지를 드래그하거나 클릭</p>
            <small>JPG / PNG</small>
          </div>

          <img id="previewImage" class="preview hidden" />
        </label>

        <button id="uploadBtn" class="upload-btn" disabled>
          업로드
        </button>

        <p id="uploadStatus" class="upload-status"></p>

      </div>


      <!-- 결과 영역 (처음에는 안내 표시) -->
      <div id="uploadResult" class="result-card">

        <h3>영수증 분석</h3>

        <div class="result-empty">

          <div class="empty-icon">📊</div>

          <p>
            영수증 또는 결제 문자 이미지를 업로드하면<br>
            자동으로 금액과 카테고리를 분석합니다.
          </p>

        </div>

      </div>

    </div>

  </div>
  `;
}


/* ========================================
   AFTER RENDER
======================================== */

export async function afterRenderUpload() {

  const dropZone = document.getElementById("dropZone");
  const dropContent = document.getElementById("dropContent");
  const fileInput = document.getElementById("receiptFile");
  const preview = document.getElementById("previewImage");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("uploadStatus");
  const resultBox = document.getElementById("uploadResult");

  let selectedFile = null;
  let previewURL = null;


  /* ==========================
     파일 처리
  ========================== */

  function handleFile(file) {

    if (!file) return;

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
  }


  /* ==========================
     파일 선택
  ========================== */

  fileInput.addEventListener("change", () => {
    handleFile(fileInput.files[0]);
  });


  /* ==========================
     드래그 앤 드롭
  ========================== */

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

    const file = e.dataTransfer.files[0];
    handleFile(file);

  });


  /* ==========================
     업로드 실행
  ========================== */

  uploadBtn.addEventListener("click", async () => {

    if (!selectedFile) {
      alert("파일을 선택하세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    uploadBtn.disabled = true;
    uploadBtn.innerText = "분석 중...";
    status.innerText = "AI 분석 중...";

    try {

      const token = localStorage.getItem("access_token");

      const res = await fetch("http://localhost:8002/receipts/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error("업로드 실패");
      }

      status.innerText = "업로드 성공";


      /* ==========================
         결과 카드 변경
      ========================== */

      resultBox.innerHTML = `
        <h3>분석 결과</h3>

        <img src="${previewURL}" class="result-preview"/>

        <div class="result-info">

          <div>
            <span>상호명</span>
            <strong>${data.merchant_name || "-"}</strong>
          </div>

          <div>
            <span>금액</span>
            <strong>${
              data.amount
                ? Number(data.amount).toLocaleString() + " 원"
                : "-"
            }</strong>
          </div>

          <div>
            <span>카테고리</span>
            <strong>${data.category || "-"}</strong>
          </div>

        </div>
      `;

      resultBox.scrollIntoView({ behavior: "smooth" });

    } catch (err) {

      status.innerText = "서버 오류";

    } finally {

      uploadBtn.disabled = false;
      uploadBtn.innerText = "업로드";

    }

  });

}