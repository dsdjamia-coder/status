import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, orderBy, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { model1 } from "../templates/model1.js";
import { model2 } from "../templates/model2.js";
import { model3 } from "../templates/model3.js";
import { SHOWCASE_CAMPAIGNS, FAQ_ITEMS } from "./campaigns.js";

// Make PRESETS and other variables accessible
export const PRESETS = { model_1: model1, model_2: model2, model_3: model3 };

let app, db, auth;
let currentUser = null;
let activeTemplate = null;
let currentConfig = { ...model1 };
let cropper = null;
let customTemplateImage = new Image();
let compressedEditorImgBase64 = '';
let currentEditId = null;

// Immediately attach essential app methods to window.app to solve timing / not a function errors
window.app = {
  navigateTo: (view, param, push) => navigateTo(view, param, push),
  openCampaign: (id) => navigateTo('generatorView', id),
  copyShareLink: (url) => copyShareLink(url),
  deleteProject: (id) => deleteProject(id),
  openEditor: (preset) => openEditor(preset),
  toggleFaq: (idx) => toggleFaq(idx),
  googleLogin: () => googleLogin(),
  logout: () => logout(),
  saveTemplate: () => saveTemplate(),
  updateSandboxPreview: () => updateSandboxPreview()
};

// Initialize Firebase
try {
  const firebaseConfig = await fetch('./firebase-applet-config.json').then(r => r.json());
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth();
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

const OperationType = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', LIST: 'list', GET: 'get', WRITE: 'write' };
function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null
    },
    operationType,
    path
  };
  console.error('Firestore Error Log:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global UI Navigation with Browser History Support
export function navigateTo(viewName, param = null, pushState = true) {
  const views = ['landingView', 'generatorView', 'adminAuthView', 'adminDashboardView', 'adminEditorView'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(viewName);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Sync browser url context
  if (pushState) {
    let url = window.location.pathname;
    if (viewName === 'generatorView' && param) {
      url += `?id=${param}`;
    } else if (viewName === 'adminDashboardView') {
      url += `?view=dashboard`;
    } else if (viewName === 'adminEditorView') {
      url += `?view=editor`;
    } else if (viewName === 'adminAuthView') {
      url += `?view=auth`;
    }
    window.history.pushState({ view: viewName, param: param }, '', url);
  }

  if (viewName === 'landingView') {
    renderLandingCampaigns();
    renderFaqs();
  } else if (viewName === 'adminDashboardView') {
    if (!currentUser) {
      navigateTo('adminAuthView', null, pushState);
    } else {
      fetchAdminProjects();
      drawDashboardPresets();
    }
  } else if (viewName === 'generatorView') {
    if (param) loadTemplateForGeneration(param);
  }
}

// Handle browser device back button navigation naturally
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.view) {
    navigateTo(event.state.view, event.state.param, false);
  } else {
    navigateTo('landingView', null, false);
  }
});

// Render Dashboard Template Thumbnails Programmatically
function drawDashboardPresets() {
  setTimeout(() => {
    ['model_1', 'model_2', 'model_3'].forEach(modelId => {
      const cvs = document.getElementById(`dashboard_thumb_${modelId}`);
      if (cvs) {
        const ctx = cvs.getContext('2d');
        const preset = PRESETS[modelId];
        if (preset) {
          preset.drawBackground(ctx, 300, 300);
          ctx.save();
          clipShape(ctx, preset.photoShape || 'circle', preset.photoX * 300/1080, preset.photoY * 300/1080, preset.photoWidth * 300/1080, preset.photoHeight * 300/1080);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(preset.photoX * 300/1080, preset.photoY * 300/1080, preset.photoWidth * 300/1080, preset.photoHeight * 300/1080);
          ctx.restore();
          preset.drawForeground(ctx, 300, 300, preset.title);
        }
      }
    });
  }, 100);
}

// Show clean, modern custom Toast alert
function showToast(message, type = "success") {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `fixed bottom-4 right-4 z-50 px-6 py-3.5 rounded-2xl font-black shadow-2xl text-white transform translate-y-0 opacity-100 transition duration-300 ${type === 'success' ? 'bg-emerald-700 border border-emerald-600' : 'bg-rose-700 border border-rose-600'}`;
  setTimeout(() => {
    toast.className = 'fixed bottom-4 right-4 z-50 px-6 py-3.5 rounded-2xl font-black shadow-2xl text-white transform translate-y-10 opacity-0 transition duration-300 pointer-events-none text-xs';
  }, 3500);
}

// Render campaign grid on Landing Page
function renderLandingCampaigns() {
  const container = document.getElementById('campaignsGrid');
  if (!container) return;

  container.innerHTML = SHOWCASE_CAMPAIGNS.map(c => `
    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer" onclick="window.app.openCampaign('${c.id}')">
      <div class="h-64 relative bg-slate-50 flex items-center justify-center overflow-hidden">
        <canvas id="thumb_${c.id}" width="500" height="500" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"></canvas>
        <span class="absolute top-3 right-3 bg-emerald-800/90 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-md">
          ${c.badge}
        </span>
      </div>
      <div class="p-5 flex flex-col justify-between flex-1">
        <div>
          <h4 class="font-black text-slate-800 text-base tracking-tight">${c.title}</h4>
          <p class="text-xs text-slate-400 mt-0.5">${c.subtitle}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-black text-emerald-800">
          <span>Create My Poster</span>
          <span class="group-hover:translate-x-1.5 transition-transform">&rarr;</span>
        </div>
      </div>
    </div>
  `).join('');

  // Pre-render miniature canvas preview images in the background
  setTimeout(() => {
    SHOWCASE_CAMPAIGNS.forEach(c => {
      const cvs = document.getElementById(`thumb_${c.id}`);
      if (cvs) {
        const ctx = cvs.getContext('2d');
        const preset = PRESETS[c.modelId];
        if (preset) {
          preset.drawBackground(ctx, 500, 500);
          ctx.save();
          clipShape(ctx, c.shape, 130, 80, 240, 240);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(130, 80, 240, 240);
          ctx.restore();
          preset.drawForeground(ctx, 500, 500, c.title);
        }
      }
    });
  }, 100);
}

function renderFaqs() {
  const container = document.getElementById('faqContainer');
  if (!container) return;

  container.innerHTML = FAQ_ITEMS.map((item, idx) => `
    <div class="faq-item border-b border-slate-100 py-4 cursor-pointer" data-idx="${idx}">
      <div class="flex justify-between items-center gap-4">
        <h4 class="font-bold text-slate-800 text-sm md:text-base">${item.question}</h4>
        <svg id="faqIcon_${idx}" class="w-5 h-5 text-emerald-800 transform transition-transform duration-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <p id="faqAnswer_${idx}" class="hidden text-xs md:text-sm text-slate-500 mt-2 leading-relaxed pr-6">${item.answer}</p>
    </div>
  `).join('');

  // Register programmatic event handlers for all items
  container.querySelectorAll('.faq-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = el.getAttribute('data-idx');
      toggleFaq(idx);
    });
  });
}

export function toggleFaq(idx) {
  const ans = document.getElementById(`faqAnswer_${idx}`);
  const icon = document.getElementById(`faqIcon_${idx}`);
  if (ans && icon) {
    const isClosed = ans.classList.contains('hidden');
    ans.classList.toggle('hidden');
    icon.style.transform = isClosed ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

// Shape Clipping Canvas Helper
function clipShape(ctx, shape, x, y, w, h) {
  ctx.beginPath();
  if (shape === 'circle') {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    const r = 40;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else if (shape === 'hexagon') {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 4);
    ctx.lineTo(x + w, y + 3 * h / 4);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + 3 * h / 4);
    ctx.lineTo(x, y + h / 4);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
}

// Load Campaign Template context for poster rendering
export async function loadTemplateForGeneration(id) {
  // Check if showcase static campaigns
  const presetCampaign = SHOWCASE_CAMPAIGNS.find(c => c.id === id);
  if (presetCampaign) {
    const preset = PRESETS[presetCampaign.modelId];
    currentConfig = { ...preset, title: presetCampaign.title, photoShape: presetCampaign.shape };
    setupGeneratorUI();
    return;
  }

  try {
    const docRef = doc(db, 'events', id);
    const snap = await getDoc(docRef).catch(e => handleFirestoreError(e, OperationType.GET, `events/${id}`));
    if (snap.exists()) {
      currentConfig = { ...snap.data() };
      updateDoc(docRef, { viewCount: (currentConfig.viewCount || 0) + 1 }).catch(() => {});
    } else {
      currentConfig = { ...PRESETS.model_1 };
    }
  } catch (err) {
    currentConfig = { ...PRESETS.model_1 };
  }
  setupGeneratorUI();
}

function setupGeneratorUI() {
  document.getElementById('genBadge').textContent = currentConfig.title;
  document.getElementById('genTitle').textContent = `Generate: ${currentConfig.title}`;
  
  const nameGrp = document.getElementById('nameInputGroup');
  const photoGrp = document.getElementById('photoInputGroup');
  if (nameGrp) nameGrp.style.display = currentConfig.enableName !== false ? 'block' : 'none';
  if (photoGrp) photoGrp.style.display = currentConfig.enablePhoto !== false ? 'block' : 'none';

  document.getElementById('genResultView').classList.add('hidden');
  document.getElementById('genWorkspace').classList.remove('hidden');
  document.getElementById('cropBox').classList.add('hidden');
  document.getElementById('formBox').classList.remove('hidden');
  document.getElementById('participantName').value = '';

  drawStaticPreview();
}

// Render dynamic previews of templates
function drawStaticPreview() {
  const cvs = document.getElementById('staticPreviewCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1080);

  if (currentConfig.modelId !== 'custom') {
    const preset = PRESETS[currentConfig.modelId];
    if (preset) {
      preset.drawBackground(ctx, 1080, 1080);
      if (currentConfig.enablePhoto !== false) {
        ctx.save();
        clipShape(ctx, currentConfig.photoShape || 'circle', currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PHOTO REGION', currentConfig.photoX + currentConfig.photoWidth/2, currentConfig.photoY + currentConfig.photoHeight/2);
        ctx.restore();
      }
      preset.drawForeground(ctx, 1080, 1080, currentConfig.title);
    }
  } else if (currentConfig.imageUrl) {
    customTemplateImage.onload = () => {
      ctx.drawImage(customTemplateImage, 0, 0, 1080, 1080);
    };
    customTemplateImage.src = currentConfig.imageUrl;
  }
}

// Compile final image and render to viewport
export function renderCompiledPoster() {
  const name = document.getElementById('participantName').value.trim();
  const cvs = document.getElementById('finalPosterCanvas');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1080);

  let croppedPhotoCanvas = null;
  if (cropper && currentConfig.enablePhoto !== false) {
    croppedPhotoCanvas = cropper.getCroppedCanvas({ width: currentConfig.photoWidth, height: currentConfig.photoHeight });
  }

  if (currentConfig.modelId !== 'custom') {
    const preset = PRESETS[currentConfig.modelId];
    if (preset) {
      preset.drawBackground(ctx, 1080, 1080);
      if (croppedPhotoCanvas) {
        ctx.save();
        clipShape(ctx, currentConfig.photoShape || 'circle', currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
        ctx.clip();
        ctx.drawImage(croppedPhotoCanvas, currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
        ctx.restore();
      }
      preset.drawForeground(ctx, 1080, 1080, currentConfig.title);
    }
  } else {
    // Draw cropped photo first then draw custom cutout template overlay on top
    if (croppedPhotoCanvas) {
      ctx.save();
      clipShape(ctx, currentConfig.photoShape || 'circle', currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
      ctx.clip();
      ctx.drawImage(croppedPhotoCanvas, currentConfig.photoX, currentConfig.photoY, currentConfig.photoWidth, currentConfig.photoHeight);
      ctx.restore();
    }
    if (customTemplateImage.src) ctx.drawImage(customTemplateImage, 0, 0, 1080, 1080);
  }

  // Draw multilingual participant name on card
  if (name && currentConfig.enableName !== false) {
    ctx.font = `bold ${currentConfig.fontSize}px ${currentConfig.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(name).width;
    const boxWidth = textWidth + (currentConfig.boxPaddingX * 2);
    const boxX = currentConfig.textStartX - currentConfig.boxPaddingX;
    const boxY = currentConfig.textY - (currentConfig.boxHeight / 2);

    ctx.fillStyle = currentConfig.boxColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, currentConfig.boxHeight, currentConfig.boxRadius);
    ctx.fill();

    ctx.fillStyle = currentConfig.textColor;
    ctx.fillText(name, currentConfig.textStartX, currentConfig.textY);
  }

  document.getElementById('genWorkspace').classList.add('hidden');
  document.getElementById('genResultView').classList.remove('hidden');
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

// Drag, Drop & Resize coordinates inside layout editor
let dragMode = null;
let dragStartX = 0, dragStartY = 0;
let initX = 0, initY = 0, initW = 0, initH = 0;

export function initSandboxInteractions() {
  const cvs = document.getElementById('sandboxCanvas');
  if (!cvs) return;

  cvs.addEventListener('mousedown', (e) => {
    const rect = cvs.getBoundingClientRect();
    const scale = 1080 / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;

    const px = parseInt(document.getElementById('edPhotoX').value);
    const py = parseInt(document.getElementById('edPhotoY').value);
    const pw = parseInt(document.getElementById('edPhotoW').value);
    const ph = parseInt(document.getElementById('edPhotoH').value);
    const tx = parseInt(document.getElementById('edTextX').value);
    const ty = parseInt(document.getElementById('edTextY').value);

    // Corner handle resize
    if (mx >= px + pw - 40 && mx <= px + pw + 10 && my >= py + ph - 40 && my <= py + ph + 10) {
      dragMode = 'resize';
      dragStartX = mx; dragStartY = my;
      initW = pw; initH = ph;
      return;
    }
    // Move photobox coordinates
    if (mx >= px && mx <= px + pw && my >= py && my <= py + ph) {
      dragMode = 'movePhoto';
      dragStartX = mx; dragStartY = my;
      initX = px; initY = py;
      return;
    }
    // Move text badge coordinates
    if (mx >= tx - 80 && mx <= tx + 350 && my >= ty - 50 && my <= ty + 50) {
      dragMode = 'moveText';
      dragStartX = mx; dragStartY = my;
      initX = tx; initY = ty;
      return;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragMode) return;
    const cvs = document.getElementById('sandboxCanvas');
    const rect = cvs.getBoundingClientRect();
    const scale = 1080 / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;
    const dx = mx - dragStartX;
    const dy = my - dragStartY;

    if (dragMode === 'movePhoto') {
      const nx = Math.max(0, Math.min(1080 - initW, Math.round(initX + dx)));
      const ny = Math.max(0, Math.min(1080 - initH, Math.round(initY + dy)));
      document.getElementById('edPhotoX').value = nx;
      document.getElementById('edPhotoY').value = ny;
    } else if (dragMode === 'resize') {
      document.getElementById('edPhotoW').value = Math.max(100, Math.min(1080, Math.round(initW + dx)));
      document.getElementById('edPhotoH').value = Math.max(100, Math.min(1080, Math.round(initH + dy)));
    } else if (dragMode === 'moveText') {
      document.getElementById('edTextX').value = Math.max(0, Math.min(1080, Math.round(initX + dx)));
      document.getElementById('edTextY').value = Math.max(0, Math.min(1080, Math.round(initY + dy)));
    }
    updateSandboxPreview();
  });

  window.addEventListener('mouseup', () => { dragMode = null; });
}

export function updateSandboxPreview() {
  const cvs = document.getElementById('sandboxCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1080);

  const modelId = document.getElementById('edModelId').value;
  const shape = document.getElementById('edShape').value;
  const px = parseInt(document.getElementById('edPhotoX').value);
  const py = parseInt(document.getElementById('edPhotoY').value);
  const pw = parseInt(document.getElementById('edPhotoW').value);
  const ph = parseInt(document.getElementById('edPhotoH').value);
  const tx = parseInt(document.getElementById('edTextX').value);
  const ty = parseInt(document.getElementById('edTextY').value);
  const title = document.getElementById('edTitle').value.trim() || 'SAMPLE CAMPAIGN';

  if (modelId !== 'custom') {
    const preset = PRESETS[modelId];
    if (preset) {
      preset.drawBackground(ctx, 1080, 1080);
      ctx.save();
      clipShape(ctx, shape, px, py, pw, ph);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'; // sky blue preview overlay
      ctx.fillRect(px, py, pw, ph);
      ctx.restore();

      ctx.save();
      clipShape(ctx, shape, px, py, pw, ph);
      ctx.strokeStyle = '#0ea5e9'; // sky blue glowing boundary
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Corner handle for resize
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(px + pw - 20, py + ph - 20, 20, 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DRAG TO POSITION PHOTO', px + pw/2, py + ph/2);

      preset.drawForeground(ctx, 1080, 1080, title);
    }
  } else {
    // Custom graphics upload preview mode
    if (compressedEditorImgBase64) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 1080, 1080);
        
        ctx.save();
        clipShape(ctx, shape, px, py, pw, ph);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.fillRect(px, py, pw, ph);
        ctx.restore();
        
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PHOTO REGION', px + pw/2, py + ph/2);
      };
      img.src = compressedEditorImgBase64;
    } else {
      ctx.fillStyle = '#f0fdfa';
      ctx.fillRect(0, 0, 1080, 1080);
      
      ctx.save();
      clipShape(ctx, shape, px, py, pw, ph);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(px, py, pw, ph);
      ctx.restore();

      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UPLOAD PNG GRAPHIC TO VIEW OVERLAY', width / 2, height / 2);
    }
  }

  // Draw sample mock name badge in sandbox
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0ea5e9'; // Sky blue name tag
  ctx.beginPath();
  ctx.roundRect(tx - 30, ty - 45, 360, 90, 25);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('John Doe / പേര്', tx, ty);
}

// Fetch user campaigns from Firestore database
async function fetchAdminProjects() {
  const container = document.getElementById('adminProjectsList');
  if (!container) return;
  container.innerHTML = '<div class="col-span-3 text-center py-8 text-slate-400">Loading your campaigns...</div>';

  try {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'events'));
    
    if (snap.empty) {
      container.innerHTML = '<div class="col-span-3 text-center py-10 bg-white rounded-3xl border border-dashed border-sky-200 text-slate-400">No custom campaigns yet. Choose one of our model templates below to begin!</div>';
      return;
    }

    container.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const shareUrl = `${window.location.origin}/?id=${data.id}`;
      return `
        <div class="bg-white border border-sky-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start mb-2">
              <span class="bg-sky-50 text-sky-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-sky-100">${data.id}</span>
              <span class="text-xs text-slate-400">${data.viewCount || 0} views</span>
            </div>
            <h4 class="font-extrabold text-slate-800 text-base">${data.title}</h4>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            <button class="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm" onclick="window.app.copyShareLink('${shareUrl}')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              <span>Copy Link</span>
            </button>
            <button class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-2.5 rounded-xl transition" onclick="window.app.deleteProject('${data.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="col-span-3 text-center py-6 text-rose-500">Failed to load active campaign templates.</div>';
  }
}

// Google Authentication Handlers
export async function googleLogin() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    document.getElementById('profileDropdown')?.classList.add('hidden');
    navigateTo('adminDashboardView');
    showToast("Successfully signed in with Google Account!");
  } catch (err) {
    showToast("Google Authentication failed: " + err.message, "error");
  }
}

export async function logout() {
  try {
    await signOut(auth);
    document.getElementById('profileDropdown')?.classList.add('hidden');
    navigateTo('landingView');
    showToast("Logged out of session.");
  } catch (err) {
    showToast("Error logging out", "error");
  }
}

export function copyShareLink(url) {
  navigator.clipboard.writeText(url);
  showToast("Shareable campaign link copied to clipboard!");
}

export async function deleteProject(id) {
  if (confirm("Are you sure you want to delete this custom campaign? All views and counters will be deleted permanently.")) {
    await deleteDoc(doc(db, 'events', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `events/${id}`));
    showToast("Campaign deleted successfully.");
    fetchAdminProjects();
  }
}

export function openEditor(presetId = null) {
  if (!currentUser) {
    navigateTo('adminAuthView');
    showToast("Please sign in with Google to create and customize campaigns.", "error");
    return;
  }
  navigateTo('adminEditorView');
  
  const customGrp = document.getElementById('edCustomFileGroup');
  if (presetId === 'custom') {
    document.getElementById('edModelId').value = 'custom';
    if (customGrp) customGrp.classList.remove('hidden');
  } else {
    if (customGrp) customGrp.classList.add('hidden');
    if (presetId) {
      document.getElementById('edModelId').value = presetId;
    }
  }

  document.getElementById('edTitle').value = presetId ? 'My Custom ' + presetId.replace('_', ' ').toUpperCase() : 'New Campaign Event';
  document.getElementById('edSlug').value = 'campaign-' + Math.floor(Math.random() * 100000);
  compressedEditorImgBase64 = '';
  document.getElementById('edCustomFileInput').value = '';
  updateSandboxPreview();
}

export async function saveTemplate() {
  const id = document.getElementById('edSlug').value.trim().toLowerCase();
  const title = document.getElementById('edTitle').value.trim();
  const modelId = document.getElementById('edModelId').value;
  
  if (!id || !title) {
    showToast("Please provide a valid unique URL ID (Slug) and Title", "error");
    return;
  }

  if (modelId === 'custom' && !compressedEditorImgBase64) {
    showToast("Please select and upload a PNG cutout graphic first.", "error");
    return;
  }

  const payload = {
    id,
    title,
    modelId,
    photoShape: document.getElementById('edShape').value,
    photoX: parseInt(document.getElementById('edPhotoX').value),
    photoY: parseInt(document.getElementById('edPhotoY').value),
    photoWidth: parseInt(document.getElementById('edPhotoW').value),
    photoHeight: parseInt(document.getElementById('edPhotoH').value),
    textStartX: parseInt(document.getElementById('edTextX').value),
    textY: parseInt(document.getElementById('edTextY').value),
    imageUrl: modelId === 'custom' ? compressedEditorImgBase64 : null,
    fontSize: 48,
    fontFamily: "'Noto Kufi Arabic', 'Noto Sans Malayalam', 'Poppins', sans-serif",
    textColor: '#ffffff',
    boxColor: '#0ea5e9', // default sky blue name plate
    boxPaddingX: 40,
    boxHeight: 90,
    boxRadius: 25,
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.uid || "anonymous",
    creatorEmail: currentUser?.email || "anonymous",
    viewCount: 0,
    generationCount: 0
  };

  try {
    await setDoc(doc(db, 'events', id), payload).catch(e => handleFirestoreError(e, OperationType.WRITE, `events/${id}`));
    showToast("Campaign template saved onto the cloud successfully!");
    navigateTo('adminDashboardView');
  } catch (err) {
    showToast("Firestore permissions error saving campaign. Verify ownership permissions.", "error");
  }
}

// Listen to Authentication State changes
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('navLoginBtn');
  const userProfile = document.getElementById('navProfileMenu');
  
  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userProfile) {
      userProfile.classList.remove('hidden');
      document.getElementById('navProfileImg').src = user.photoURL || 'https://via.placeholder.com/80';
      const menuImg = document.getElementById('menuProfileImg');
      if (menuImg) menuImg.src = user.photoURL || 'https://via.placeholder.com/80';
      const menuName = document.getElementById('menuProfileName');
      if (menuName) menuName.textContent = user.displayName || 'User Account';
      const menuEmail = document.getElementById('menuEmail');
      if (menuEmail) menuEmail.textContent = user.email || '';
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
  }
});

// Programmatic Registration of Event Handlers with fail-safe immediate execution
function initializeApplication() {
  // Parse incoming URLs and route directly
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const view = params.get('view');

  if (id) {
    navigateTo('generatorView', id);
  } else if (view === 'dashboard') {
    navigateTo('adminDashboardView');
  } else if (view === 'editor') {
    navigateTo('adminEditorView');
  } else if (view === 'auth') {
    navigateTo('adminAuthView');
  } else {
    navigateTo('landingView');
  }

  initSandboxInteractions();

  // Attach programmatic element listeners
  document.getElementById('btnBrandHome')?.addEventListener('click', () => navigateTo('landingView'));
  document.getElementById('navLoginBtn')?.addEventListener('click', () => googleLogin());
  
  // User Profile Dropdown handlers
  document.getElementById('btnProfileToggle')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.toggle('hidden');
  });
  document.getElementById('btnNavDashboard')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.add('hidden');
    navigateTo('adminDashboardView');
  });
  document.getElementById('btnNavNewCampaign')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.add('hidden');
    openEditor();
  });
  document.getElementById('btnNavPrivacy')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.add('hidden');
    navigateTo('landingView');
    setTimeout(() => {
      document.getElementById('exploreCampaignsSec')?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  });
  document.getElementById('btnNavAbout')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.add('hidden');
    navigateTo('landingView');
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 200);
  });
  document.getElementById('btnNavLogout')?.addEventListener('click', () => {
    document.getElementById('profileDropdown')?.classList.add('hidden');
    logout();
  });

  // Hamburger Link -> Opens Mobile Side Drawer Panel
  document.getElementById('navDashboardLink')?.addEventListener('click', () => {
    document.getElementById('mobileDrawer')?.classList.remove('hidden');
  });

  // Mobile Side Drawer actions
  const closeDrawer = () => {
    document.getElementById('mobileDrawer')?.classList.add('hidden');
  };
  document.getElementById('btnDrawerClose')?.addEventListener('click', closeDrawer);
  document.getElementById('btnDrawerBackdrop')?.addEventListener('click', closeDrawer);

  document.getElementById('btnDrawerHome')?.addEventListener('click', () => {
    closeDrawer();
    navigateTo('landingView');
  });
  document.getElementById('btnDrawerDashboard')?.addEventListener('click', () => {
    closeDrawer();
    navigateTo('adminDashboardView');
  });
  document.getElementById('btnDrawerNewCampaign')?.addEventListener('click', () => {
    closeDrawer();
    openEditor();
  });
  document.getElementById('btnDrawerPrivacy')?.addEventListener('click', () => {
    closeDrawer();
    navigateTo('landingView');
    setTimeout(() => {
      document.getElementById('exploreCampaignsSec')?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  });
  document.getElementById('btnDrawerAbout')?.addEventListener('click', () => {
    closeDrawer();
    navigateTo('landingView');
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 200);
  });
  
  document.getElementById('btnHeroLaunch')?.addEventListener('click', () => openEditor());
  document.getElementById('btnHeroExplore')?.addEventListener('click', () => {
    document.getElementById('exploreCampaignsSec')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('btnLaunchCampaign')?.addEventListener('click', () => openEditor());

  document.getElementById('btnBackHome')?.addEventListener('click', () => navigateTo('landingView'));
  document.getElementById('btnBackToCampaigns')?.addEventListener('click', () => navigateTo('landingView'));
  
  document.getElementById('btnBackFromAuth')?.addEventListener('click', () => navigateTo('landingView'));
  document.getElementById('btnGoogleLoginCard')?.addEventListener('click', () => googleLogin());

  document.getElementById('btnNewCampaign')?.addEventListener('click', () => openEditor());
  document.getElementById('btnBackFromEditor')?.addEventListener('click', () => navigateTo('adminDashboardView'));

  document.getElementById('btnCustomTemplate')?.addEventListener('click', () => openEditor('custom'));
  document.getElementById('btnPreset1')?.addEventListener('click', () => openEditor('model_1'));
  document.getElementById('btnPreset2')?.addEventListener('click', () => openEditor('model_2'));
  document.getElementById('btnPreset3')?.addEventListener('click', () => openEditor('model_3'));

  document.getElementById('btnSaveTemplate')?.addEventListener('click', () => saveTemplate());
  document.getElementById('btnScrollTop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Close profile dropdown menu when clicking anywhere else on the screen
  document.addEventListener('click', (e) => {
    const profileMenu = document.getElementById('navProfileMenu');
    const dropdown = document.getElementById('profileDropdown');
    if (profileMenu && !profileMenu.contains(e.target)) {
      dropdown?.classList.add('hidden');
    }
  });

  // Editor Preset dropdown dynamic cutout upload display
  document.getElementById('edModelId')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const customGrp = document.getElementById('edCustomFileGroup');
    if (val === 'custom') {
      customGrp?.classList.remove('hidden');
    } else {
      customGrp?.classList.add('hidden');
    }
    updateSandboxPreview();
  });

  document.getElementById('edShape')?.addEventListener('change', () => updateSandboxPreview());
  document.getElementById('edTitle')?.addEventListener('input', () => updateSandboxPreview());

  // Handle Photo selection & Cropper
  const fileInput = document.getElementById('photoInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = document.getElementById('cropTargetImg');
          if (img) {
            img.src = ev.target.result;
            document.getElementById('formBox')?.classList.add('hidden');
            document.getElementById('cropBox')?.classList.remove('hidden');
            if (cropper) cropper.destroy();
            cropper = new Cropper(img, { aspectRatio: 1, viewMode: 1, dragMode: 'move' });
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle Custom Cutout upload inside layout customizer
  const edCustomFileInput = document.getElementById('edCustomFileInput');
  if (edCustomFileInput) {
    edCustomFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const tempImg = new Image();
          tempImg.onload = () => {
            // Compress image to keep Base64 payload small and quick to save
            const tempCvs = document.createElement('canvas');
            const maxDim = 1080;
            let w = tempImg.width;
            let h = tempImg.height;
            if (w > h) {
              if (w > maxDim) {
                h = Math.round(h * maxDim / w);
                w = maxDim;
              }
            } else {
              if (h > maxDim) {
                w = Math.round(w * maxDim / h);
                h = maxDim;
              }
            }
            tempCvs.width = w;
            tempCvs.height = h;
            const tempCtx = tempCvs.getContext('2d');
            tempCtx.drawImage(tempImg, 0, 0, w, h);
            compressedEditorImgBase64 = tempCvs.toDataURL('image/png');
            updateSandboxPreview();
            showToast("Cutout graphic successfully optimized and loaded.");
          };
          tempImg.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  document.getElementById('btnCompile')?.addEventListener('click', renderCompiledPoster);
  document.getElementById('btnCropCancel')?.addEventListener('click', () => {
    document.getElementById('cropBox')?.classList.add('hidden');
    document.getElementById('formBox')?.classList.remove('hidden');
  });
  
  document.getElementById('btnDownload')?.addEventListener('click', () => {
    const canvas = document.getElementById('finalPosterCanvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'My_Campaign_Poster.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      showToast("Download started successfully.");
    }
  });

  document.getElementById('btnSharePoster')?.addEventListener('click', async () => {
    const canvas = document.getElementById('finalPosterCanvas');
    if (!canvas) return;

    try {
      showToast("Preparing image for sharing...", "success");
      
      // 1. Convert Canvas to Blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) {
        showToast("Failed to prepare poster image.", "error");
        return;
      }
      
      // 2. Create File object
      const file = new File([blob], 'My_Campaign_Poster.jpg', { type: 'image/jpeg' });
      
      // 3. Share using Web Share API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: currentConfig.title || 'My Campaign Poster',
          text: `Check out my personalized poster for ${currentConfig.title || 'the campaign'} generated on campaign.dsd!`
        });
      } else {
        // Fallback for browsers that don't support file sharing
        showToast("Web Share is not supported on this browser/context. Please use the Download button.", "error");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Web Share failed:", err);
        showToast("Sharing failed: " + err.message, "error");
      }
    }
  });

  // -------------------------------------------------------------
  // 📲 PROGRESSIVE WEB APP (PWA) REGISTRATION & INSTALL
  // -------------------------------------------------------------
  
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered successfully', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  // 2. Handle in-app install prompt UI
  let deferredPrompt = null;
  const pwaInstallBtn = document.getElementById('btnPWAInstall');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (pwaInstallBtn && !isStandalone) {
    // iOS Safari Specific flow (ambient beforeinstallprompt is not supported)
    if (isIOS) {
      pwaInstallBtn.classList.remove('hidden');
      pwaInstallBtn.addEventListener('click', () => {
        alert("To install campaign.dsd App on iOS Safari:\n\n1. Tap the Share icon in the bottom/top toolbar.\n2. Scroll down and tap 'Add to Home Screen'.");
      });
    }

    // Android, Chrome, and standard chromium desktop flow
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      pwaInstallBtn.classList.remove('hidden');
    });

    pwaInstallBtn.addEventListener('click', async () => {
      if (isIOS) return; // Safari flows are handled above
      
      if (!deferredPrompt) {
        showToast("Installation is currently unavailable.", "error");
        return;
      }
      
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast("Installation accepted. Thank you!");
          pwaInstallBtn.classList.add('hidden');
          deferredPrompt = null;
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    });

    window.addEventListener('appinstalled', () => {
      showToast("campaign.dsd App installed successfully!");
      pwaInstallBtn.classList.add('hidden');
      deferredPrompt = null;
    });
  }
}

// Execute immediately if DOM has already loaded (since ESM module is asynchronous)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeApplication();
} else {
  window.addEventListener('DOMContentLoaded', initializeApplication);
}
