/**
 * HERRAMEC - Motor de interacción y cotización industrial
 * Manejo de Cotizador persistente, Búsqueda en vivo, Modales y Navegación
 */

(function () {
  'use strict';

  // Configuración de la empresa oficial
  const CONFIG = {
    whatsappNumber: '51952392860',
    secondaryWhatsapp: '51970568875',
    email: 'ventas@herramec.com.pe',
    address: 'Casa Huerta La Campiña Sector B Mz. O Lt. 21 Lurigancho - Chosica, Lima - Perú'
  };

  // Estado del Cotizador
  let quoteItems = [];

  // Inicializar al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    loadQuoteFromStorage();
    updateQuoteBadge();
    bindGlobalEvents();
    setupProductQuickView();
    setupGlobalSearch();
    setupHeaderScroll();
    setupScrollAnimations();
    setupCounterAnimations();
  });

  // Guardar y recuperar de LocalStorage
  function loadQuoteFromStorage() {
    try {
      const saved = localStorage.getItem('herramec_quote_cart');
      if (saved) {
        quoteItems = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading quote storage:', e);
      quoteItems = [];
    }
  }

  function saveQuoteToStorage() {
    try {
      localStorage.setItem('herramec_quote_cart', JSON.stringify(quoteItems));
      updateQuoteBadge();
      renderQuoteDrawer();
    } catch (e) {
      console.warn('Error saving quote storage:', e);
    }
  }

  // Actualizar conteo en header con micro-animación
  function updateQuoteBadge() {
    const badges = document.querySelectorAll('.cart-count, .js-quote-count');
    const totalQty = quoteItems.reduce((acc, item) => acc + (item.qty || 1), 0);
    badges.forEach(b => {
      b.textContent = totalQty;
      b.style.display = totalQty > 0 ? 'grid' : 'none';
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
    });
  }

  // Eventos globales
  function bindGlobalEvents() {
    // Abrir drawer de cotización
    document.querySelectorAll('.js-open-quote-drawer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openQuoteDrawer();
      });
    });

    // Cerrar drawer
    const drawerOverlay = document.getElementById('quoteDrawerOverlay');
    const drawerCloseBtn = document.getElementById('quoteDrawerClose');
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', closeQuoteDrawer);
    }
    if (drawerCloseBtn) {
      drawerCloseBtn.addEventListener('click', closeQuoteDrawer);
    }

    // Menú móvil
    const menuToggle = document.getElementById('menuToggle');
    const mobileDrawer = document.getElementById('mobileNavDrawer');
    const mobileClose = document.getElementById('mobileNavClose');
    if (menuToggle && mobileDrawer) {
      menuToggle.addEventListener('click', () => {
        mobileDrawer.classList.toggle('active');
      });
    }
    if (mobileClose && mobileDrawer) {
      mobileClose.addEventListener('click', () => {
        mobileDrawer.classList.remove('active');
      });
    }

    // Botones de añadir a cotización delegados con feedback táctil
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.js-add-to-quote');
      if (addBtn) {
        e.preventDefault();
        const productId = parseInt(addBtn.dataset.id, 10);
        const qty = parseInt(addBtn.dataset.qty || 1, 10);
        addToQuote(productId, qty, addBtn);
      }
    });

    // Enviar cotización por WhatsApp
    const sendWhatsappBtn = document.getElementById('btnSendQuoteWhatsapp');
    if (sendWhatsappBtn) {
      sendWhatsappBtn.addEventListener('click', sendQuoteViaWhatsapp);
    }
  }

  // Feedback táctil para botones de añadir (UI/UX Pro Max)
  function triggerButtonFeedback(productId, btnElement) {
    const targets = [];
    if (btnElement && btnElement instanceof HTMLElement) {
      targets.push(btnElement);
    }
    document.querySelectorAll(`.js-add-to-quote[data-id="${productId}"]`).forEach(btn => {
      if (!targets.includes(btn)) targets.push(btn);
    });

    targets.forEach(btn => {
      if (btn.dataset.addingState) return;
      btn.dataset.addingState = 'true';
      const origHtml = btn.innerHTML;
      btn.classList.add('is-added');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:-2px; margin-right:4px;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>¡Añadido!</span>
      `;
      setTimeout(() => {
        btn.classList.remove('is-added');
        btn.innerHTML = origHtml;
        delete btn.dataset.addingState;
      }, 1600);
    });
  }

  // Añadir producto a cotización (UI/UX Pro Max: No despliega drawer agresivamente, confirma con micro-interacción y toast)
  window.addToQuote = function (productId, qty = 1, triggerBtn = null) {
    if (!window.HERRAMEC_PRODUCTS) return;
    const product = window.HERRAMEC_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = quoteItems.findIndex(item => item.id === productId);
    if (existingIndex > -1) {
      quoteItems[existingIndex].qty += qty;
    } else {
      quoteItems.push({
        id: product.id,
        title: product.title,
        image: product.image,
        category: product.category_name,
        material: product.material,
        qty: qty
      });
    }

    saveQuoteToStorage();

    // Feedback táctil inmediato en el botón pulsado
    triggerButtonFeedback(productId, triggerBtn);

    // Toast interactivo enriquecido (UI/UX Pro Max: No invade la pantalla con el drawer, da acceso con un clic)
    showToast({
      title: product.title,
      subtitle: `${product.category_name || 'Herramienta'} · ${qty} ${qty === 1 ? 'unidad agregada' : 'unidades agregadas'}`,
      image: product.image,
      actionLabel: 'Ver lista →',
      onAction: () => {
        openQuoteDrawer();
      }
    });
  };

  // Modificar cantidad
  window.updateItemQty = function (productId, delta) {
    const item = quoteItems.find(i => i.id === productId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      quoteItems = quoteItems.filter(i => i.id !== productId);
    }
    saveQuoteToStorage();
  };

  window.removeItemFromQuote = function (productId) {
    quoteItems = quoteItems.filter(i => i.id !== productId);
    saveQuoteToStorage();
  };

  // Modal Pop Up de Confirmación para Vaciar Cotización (UI/UX Pro Max - Sustituto elegante de confirm)
  function getOrCreateClearModal() {
    let modal = document.getElementById('clearQuoteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clearQuoteModal';
      modal.className = 'confirm-modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'clearModalTitle');
      modal.innerHTML = `
        <div class="confirm-modal-backdrop js-close-clear-modal"></div>
        <div class="confirm-modal-card">
          <button type="button" class="confirm-modal-close-btn js-close-clear-modal" aria-label="Cerrar modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="18" x2="18" y2="6"></line>
            </svg>
          </button>
          
          <div class="confirm-modal-icon-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>

          <div class="confirm-modal-content">
            <span class="confirm-modal-eyebrow">// CONFIRMACIÓN REQUERIDA</span>
            <h3 class="confirm-modal-title" id="clearModalTitle">¿Vaciar lista de cotización?</h3>
            <p class="confirm-modal-desc" id="clearModalDesc">
              Esta acción eliminará todas las herramientas de su lista (<strong id="clearModalCount">0</strong>). Podrá volver a agregarlas desde el catálogo en cualquier momento.
            </p>
          </div>

          <div class="confirm-modal-actions">
            <button type="button" class="btn btn-outline confirm-btn-cancel js-close-clear-modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-danger confirm-btn-delete" id="btnConfirmModalClear">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Sí, vaciar lista
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelectorAll('.js-close-clear-modal').forEach(btn => {
        btn.addEventListener('click', closeClearModal);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeClearModal();
        }
      });
    }
    return modal;
  }

  function openClearModal(onConfirmCallback) {
    const modal = getOrCreateClearModal();
    const countEl = modal.querySelector('#clearModalCount');
    const totalQty = quoteItems.reduce((acc, item) => acc + (item.qty || 1), 0);
    if (countEl) {
      countEl.textContent = `${quoteItems.length} ${quoteItems.length === 1 ? 'producto' : 'productos'} (${totalQty} unid.)`;
    }

    const confirmBtn = modal.querySelector('#btnConfirmModalClear');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
      closeClearModal();
      if (typeof onConfirmCallback === 'function') {
        onConfirmCallback();
      }
    });

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeClearModal() {
    const modal = document.getElementById('clearQuoteModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  window.openClearQuoteModal = openClearModal;
  window.closeClearQuoteModal = closeClearModal;

  // Limpiar toda la lista de cotización con Pop Up
  window.clearQuoteDrawer = function () {
    if (!quoteItems || quoteItems.length === 0) {
      showToast('Su lista de cotización ya está vacía', 'info');
      return;
    }
    openClearModal(() => {
      quoteItems = [];
      saveQuoteToStorage();
      showToast('Lista de cotización vaciada con éxito', 'success');
      renderQuoteDrawer();
      if (typeof renderCartPage === 'function') {
        renderCartPage();
      }
    });
  };

  // Abrir y cerrar drawer
  function openQuoteDrawer() {
    renderQuoteDrawer();
    const overlay = document.getElementById('quoteDrawerOverlay');
    const drawer = document.getElementById('quoteDrawer');
    if (overlay && drawer) {
      overlay.classList.add('active');
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeQuoteDrawer() {
    const overlay = document.getElementById('quoteDrawerOverlay');
    const drawer = document.getElementById('quoteDrawer');
    if (overlay && drawer) {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Renderizar contenido del Drawer
  function renderQuoteDrawer() {
    const drawerBody = document.getElementById('quoteDrawerBody');
    const drawerFooter = document.getElementById('quoteDrawerFooter');
    if (!drawerBody) return;

    if (quoteItems.length === 0) {
      drawerBody.innerHTML = `
        <div class="drawer-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <h4>Su lista de cotización está vacía</h4>
          <p>Explore nuestro catálogo de herramientas industriales para minería y fundición y agregue los ítems requeridos.</p>
          <a href="productos.html" class="btn btn-primary btn-sm" onclick="closeQuoteDrawer()">Explorar catálogo</a>
        </div>
      `;
      if (drawerFooter) drawerFooter.style.display = 'none';
      return;
    }

    if (drawerFooter) drawerFooter.style.display = 'flex';

    const totalQty = quoteItems.reduce((acc, item) => acc + (item.qty || 1), 0);
    let html = `
      <div class="drawer-toolbar">
        <span class="drawer-toolbar-count"><strong>${quoteItems.length}</strong> ${quoteItems.length === 1 ? 'producto' : 'productos'} (${totalQty} unid.)</span>
        <button class="btn-clear-mini" onclick="clearQuoteDrawer()" title="Vaciar toda la lista">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Limpiar lista
        </button>
      </div>
    `;
    quoteItems.forEach(item => {
      html += `
        <div class="quote-item-card">
          <img src="${item.image}" alt="${item.title}" class="quote-item-thumb" onerror="this.src='https://www.herramec.com.pe/wp-content/themes/sailo/assets/images/preloader.png'">
          <div class="quote-item-info">
            <div>
              <div class="text-xs text-slate font-mono" style="margin-bottom:2px;">${item.category}</div>
              <h5 class="quote-item-title">${item.title}</h5>
            </div>
            <div class="quote-item-controls">
              <div class="quantity-control">
                <button class="quantity-btn" onclick="updateItemQty(${item.id}, -1)">-</button>
                <span class="quantity-display">${item.qty}</span>
                <button class="quantity-btn" onclick="updateItemQty(${item.id}, 1)">+</button>
              </div>
              <button class="quote-item-remove" onclick="removeItemFromQuote(${item.id})">Eliminar</button>
            </div>
          </div>
        </div>
      `;
    });

    drawerBody.innerHTML = html;
  }

  // Generar y enviar mensaje a WhatsApp
  function sendQuoteViaWhatsapp() {
    if (quoteItems.length === 0) return;

    let message = `*SOLICITUD DE COTIZACIÓN - HERRAMEC EIRL*\n`;
    message += `Hola, solicito cotización formal para los siguientes productos industriales:\n\n`;

    quoteItems.forEach((item, index) => {
      message += `${index + 1}. *${item.title}* (Cant: ${item.qty} unid.)\n`;
      message += `   - Categoría: ${item.category}\n`;
      message += `   - Material: ${item.material}\n\n`;
    });

    message += `Agradeceré remitir disponibilidad técnica, tiempo de entrega y precios en Soles/Dólares.\n`;
    message += `Atención: Departamento de Adquisiciones / Operaciones.`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encoded}`;
    window.open(url, '_blank');
  }

  // Toast Notification UI/UX Pro Max (Soporta mensajes de texto y tarjetas de producto interactivas)
  window.showToast = function (opts, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-card';

    if (typeof opts === 'string') {
      const isSuccess = type === 'success' || opts.includes('añadido') || opts.includes('limpiada') || opts.includes('vaciada');
      toast.className += isSuccess ? ' toast-product' : ' toast-info';
      toast.innerHTML = `
        <div class="toast-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="toast-content">
          <span class="toast-message">${opts}</span>
        </div>
        <button type="button" class="toast-close" aria-label="Cerrar">&times;</button>
      `;
    } else {
      toast.className += ' toast-product';
      const imgTag = opts.image 
        ? `<img src="${opts.image}" alt="${opts.title || ''}" class="toast-thumb" onerror="this.src='https://www.herramec.com.pe/wp-content/themes/sailo/assets/images/preloader.png'">`
        : `<div class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;

      toast.innerHTML = `
        ${imgTag}
        <div class="toast-content">
          <span class="toast-kicker">✓ AGREGADO A COTIZACIÓN</span>
          <strong class="toast-title">${opts.title || ''}</strong>
          ${opts.subtitle ? `<span class="toast-sub">${opts.subtitle}</span>` : ''}
        </div>
        ${opts.actionLabel ? `<button type="button" class="toast-action-btn js-toast-action">${opts.actionLabel}</button>` : ''}
        <button type="button" class="toast-close" aria-label="Cerrar">&times;</button>
      `;

      if (opts.onAction) {
        const actionBtn = toast.querySelector('.js-toast-action');
        if (actionBtn) {
          actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            opts.onAction();
            dismissToast(toast);
          });
        }
      }
    }

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => dismissToast(toast));
    }

    container.appendChild(toast);

    const timer = setTimeout(() => {
      dismissToast(toast);
    }, 4200);

    function dismissToast(el) {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add('toast-leaving');
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 300);
    }
  };

  // Quick View Modal
  function setupProductQuickView() {
    window.openQuickView = function (productId) {
      if (!window.HERRAMEC_PRODUCTS) return;
      const product = window.HERRAMEC_PRODUCTS.find(p => p.id === productId);
      if (!product) return;

      let modalOverlay = document.getElementById('quickViewModal');
      if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'quickViewModal';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.innerHTML = `
          <div class="modal-card" style="padding: 32px; position:relative;">
            <button class="modal-close-btn" onclick="closeQuickView()" aria-label="Cerrar modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div id="quickViewContent"></div>
          </div>
        `;
        document.body.appendChild(modalOverlay);
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) closeQuickView();
        });
      }

      const measuresHtml = Object.keys(product.measures).length > 0 
        ? `<div style="background:var(--c-slate-50); border:1px solid var(--c-slate-200); border-radius:var(--radius-xs); padding:16px; margin:16px 0;">
             <strong style="font-size:0.75rem; text-transform:uppercase; color:var(--c-slate-600); font-family:var(--font-mono); letter-spacing:0.06em; display:block; margin-bottom:8px;">Especificaciones Técnicas:</strong>
             <ul style="list-style:none; display:grid; gap:6px; font-size:0.875rem;">
               ${Object.entries(product.measures).map(([k, v]) => `<li><strong style="color:var(--c-slate-900); font-family:var(--font-mono);">${k}:</strong> ${v}</li>`).join('')}
             </ul>
           </div>`
        : '';

      const content = document.getElementById('quickViewContent');
      content.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:32px; align-items:center;">
          <div style="background:#fafbfc; border:1px solid var(--c-slate-200); border-radius:var(--radius-xs); padding:24px; display:flex; align-items:center; justify-content:center; height:320px;">
            <img src="${product.image}" alt="${product.title}" style="max-height:100%; max-width:100%; width:auto; height:auto; object-fit:contain;" onerror="this.src='${product.image_remote}'">
          </div>
          <div>
            <div class="eyebrow" style="margin-bottom:6px; color:var(--c-orange);">${product.sku || 'HMC'} // ${product.category_name}</div>
            <h2 style="font-size:1.6rem; margin-bottom:12px; font-family:var(--font-display);">${product.title}</h2>
            <div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <span class="badge badge-orange">${product.material}</span>
              ${product.temp_rating ? `<span class="badge badge-dark">${product.temp_rating}</span>` : ''}
            </div>
            <p style="font-size:0.9rem; color:var(--c-slate-600); margin-bottom:12px; line-height:1.6;">
              ${product.application}
            </p>
            ${measuresHtml}
            <div style="display:flex; gap:12px; margin-top:20px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="addToQuote(${product.id}); closeQuickView();">
                Añadir a Cotización ↗
              </button>
              <a href="producto-detalle.html?id=${product.id}" class="btn btn-outline">
                Ver Ficha Completa
              </a>
            </div>
          </div>
        </div>
      `;

      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    window.closeQuickView = function () {
      const modal = document.getElementById('quickViewModal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    };
  }

  // Global Search Modal
  function setupGlobalSearch() {
    window.openSearchModal = function () {
      let modal = document.getElementById('searchModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'searchModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-card search-modal-card" style="position:relative;">
            <button class="modal-close-btn" onclick="closeSearchModal()" aria-label="Cerrar búsqueda">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h3 style="font-size:1.25rem; margin-bottom:16px; font-family:var(--font-display);">Buscar Herramientas y Equipos Herramec</h3>
            <div class="search-input-wrap">
              <svg class="search-icon-inside" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="globalSearchInput" placeholder="Ej: Crisol, Palanca, Quinia, Inoxidable, Barreta..." autocomplete="off">
            </div>
            <div id="searchResultsList" class="search-results-list">
              <div class="text-sm text-slate text-center" style="padding:20px;">Escriba el nombre o característica técnica para ver resultados en tiempo real.</div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeSearchModal();
        });

        const input = document.getElementById('globalSearchInput');
        input.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase().trim();
          renderSearchResults(query);
        });
      }

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const inp = document.getElementById('globalSearchInput');
        if (inp) inp.focus();
      }, 100);
    };

    window.closeSearchModal = function () {
      const modal = document.getElementById('searchModal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    };

    function renderSearchResults(query) {
      const list = document.getElementById('searchResultsList');
      if (!list || !window.HERRAMEC_PRODUCTS) return;

      if (!query) {
        list.innerHTML = `<div class="text-sm text-slate text-center" style="padding:20px;">Escriba para filtrar entre nuestros 29 productos industriales.</div>`;
        return;
      }

      const results = window.HERRAMEC_PRODUCTS.filter(p => {
        return p.title.toLowerCase().includes(query) ||
               p.category_name.toLowerCase().includes(query) ||
               p.material.toLowerCase().includes(query) ||
               p.application.toLowerCase().includes(query) ||
               p.raw_description.toLowerCase().includes(query) ||
               (p.sku && p.sku.toLowerCase().includes(query));
      });

      if (results.length === 0) {
        list.innerHTML = `<div class="text-sm text-slate text-center" style="padding:20px;">No se encontraron productos coincidentes con "${query}". Contáctenos para fabricación a medida.</div>`;
        return;
      }

      list.innerHTML = results.map(p => `
        <a href="producto-detalle.html?id=${p.id}" class="search-result-item" onclick="closeSearchModal()">
          <img src="${p.image}" alt="${p.title}" class="search-result-thumb" onerror="this.src='${p.image_remote}'">
          <div style="flex-grow:1;">
            <div class="text-xs text-orange font-mono">${p.sku || 'HMC'} // ${p.category_name}</div>
            <strong style="font-size:0.9rem; color:var(--c-slate-900);">${p.title}</strong>
            <div class="text-xs text-slate">${p.material}</div>
          </div>
          <span style="font-size:1.1rem; color:var(--c-orange);">↗</span>
        </a>
      `).join('');
    }
  }

  // Scroll dinámico del Header (Efecto Glassmorphism y Elevación)
  function setupHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;
    const onScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('header-scrolled');
      } else {
        header.classList.remove('header-scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Animaciones de entrada suave al hacer scroll (Reveal On Scroll)
  function setupScrollAnimations() {
    const targets = document.querySelectorAll(
      '.product-card, .category-card, .service-card, .material-pillar-card, ' +
      '.mission-vision-card, .tech-trust-cell, .step-chain-card, .faq-card-unit, ' +
      '.about-stats-grid > div, .about-photo-composition, .b2b-cta-banner, ' +
      '.story-editorial-split, .story-editorial-content, .contact-card-frame, .contact-box-cell'
    );

    if (!('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -30px 0px'
    });

    targets.forEach(el => {
      el.classList.add('fade-in-up');
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);
        if (idx >= 0 && idx < 6) {
          el.classList.add(`stagger-${(idx % 5) + 1}`);
        }
      }
      observer.observe(el);
    });
  }

  // Contador numérico animado fluido para cifras clave (16+ Años, 100%, etc.)
  function setupCounterAnimations() {
    if (!('IntersectionObserver' in window)) return;
    const counterElements = document.querySelectorAll(
      '.about-stats-grid strong, .hero-spec-item span'
    );

    counterElements.forEach(el => {
      const originalText = el.textContent.trim();
      const match = originalText.match(/^(\d+)([\+%]?)(.*)$/);
      if (!match) return;

      const targetValue = parseInt(match[1], 10);
      const symbol = match[2] || '';
      const rest = match[3] || '';
      if (isNaN(targetValue) || targetValue <= 0) return;

      let animated = false;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            obs.disconnect();
            const duration = 1200;
            const startTime = performance.now();

            const tick = (now) => {
              const progress = Math.min((now - startTime) / duration, 1);
              const ease = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(targetValue * ease);
              el.textContent = `${current}${symbol}${rest}`;
              if (progress < 1) {
                requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
          }
        });
      }, { threshold: 0.3 });

      obs.observe(el);
    });
  }

  // Sistema dinámico de cambio de tema (Claro / Oscuro)
  function setupThemeToggle() {
    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('herramec_theme', theme);
      } catch (e) {}

      document.querySelectorAll('.js-theme-toggle').forEach(btn => {
        if (theme === 'dark') {
          btn.setAttribute('title', 'Cambiar a modo claro (Alt + T)');
          btn.setAttribute('aria-label', 'Cambiar a modo claro');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.setAttribute('title', 'Cambiar a modo oscuro (Alt + T)');
          btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    };

    let currentTheme = 'light';
    try {
      const saved = localStorage.getItem('herramec_theme');
      if (saved) {
        currentTheme = saved;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
      }
    } catch (e) {}

    applyTheme(currentTheme);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.js-theme-toggle');
      if (btn) {
        e.preventDefault();
        const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        showToast(nextTheme === 'dark' ? 'Modo Oscuro Industrial activado 🌙' : 'Modo Claro activado ☀️');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        showToast(nextTheme === 'dark' ? 'Modo Oscuro Industrial activado 🌙' : 'Modo Claro activado ☀️');
      }
    });
  }

})();

