let currentPage = 1;
let totalPages = 1;
let searchTimer = null;

// Toast helper
function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-lg shadow-lg text-xs font-medium transition duration-300 flex items-center space-x-2 ${
    isError ? 'bg-red-600 text-white' : 'bg-emerald-700 text-white'
  }`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// Check session
async function verifySession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Unauthenticated');
    const data = await res.json();
    document.getElementById('pharmacyLabel').innerText = data.user.pharmacyName;
  } catch {
    window.location.href = '/index.html';
  }
}

// Load inventory
async function loadInventory() {
  const search = document.getElementById('searchInput').value;
  const sortVal = document.getElementById('sortSelect').value.split('-');
  const sortBy = sortVal[0];
  const sortOrder = sortVal[1];

  const params = new URLSearchParams({
    search,
    page: currentPage,
    limit: 8,
    sortBy,
    sortOrder
  });

  const res = await fetch(`/api/medicines?${params}`);
  if (res.status === 401) {
    window.location.href = '/index.html';
    return;
  }

  const { data, pagination } = await res.json();
  currentPage = pagination.page;
  totalPages = pagination.totalPages;

  document.getElementById('paginationInfo').innerText = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`;
  document.getElementById('prevPageBtn').disabled = currentPage <= 1;
  document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;

  const tbody = document.getElementById('inventoryTbody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No matching medicines found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((med) => {
    const isSellable = med.sellable_stock > 0;
    const badgeClass = isSellable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200';
    const auditWarning = med.expired_batch_count > 0 
      ? `<span class="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-xs font-semibold">${med.expired_batch_count} Expired Batch(es) Excluded</span>`
      : `<span class="text-slate-400 text-xs">Clear</span>`;

    return `
      <tr class="hover:bg-slate-50/70 transition">
        <td class="px-6 py-4">
          <span class="font-bold text-slate-900 block">${escapeHtml(med.name)}</span>
          <span class="text-xs text-slate-400">${escapeHtml(med.category)}</span>
        </td>
        <td class="px-6 py-4">
          <span class="border px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}">
            ${med.sellable_stock} Units In-Date
          </span>
        </td>
        <td class="px-6 py-4 text-xs text-slate-600">
          ${med.next_expiry ? med.next_expiry : 'No Active Batches'}
        </td>
        <td class="px-6 py-4">
          ${auditWarning}
        </td>
        <td class="px-6 py-4 text-right space-x-2">
          <button onclick="openBatchModal(${med.id}, '${escapeHtml(med.name)}')" class="px-3 py-1 text-xs border border-slate-300 hover:bg-slate-100 rounded font-medium">+ Batch</button>
          <button onclick="openDispenseModal(${med.id}, '${escapeHtml(med.name)}', ${med.sellable_stock})" 
            ${!isSellable ? 'disabled class="px-3 py-1 text-xs rounded bg-slate-200 text-slate-400 cursor-not-allowed"' : 'class="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"'}>
            Dispense (FEFO)
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Load 30-day alerts
async function loadAlerts() {
  const res = await fetch('/api/alerts/expiring?days=30');
  const alerts = await res.json();
  const banner = document.getElementById('alertBanner');
  const list = document.getElementById('alertList');

  if (alerts.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('alertCountLabel').innerText = `${alerts.length} batch(es) expiring within 30 days`;
    list.innerHTML = alerts.map(a => `
      <div class="bg-white border border-amber-200 rounded p-2 text-xs flex justify-between items-center shadow-2xs">
        <div>
          <span class="font-semibold text-slate-800">${escapeHtml(a.medicine_name)}</span>
          <span class="text-slate-400 block">Batch: ${escapeHtml(a.batch_number)}</span>
        </div>
        <div class="text-right">
          <span class="font-bold text-red-600">${a.days_remaining}d left</span>
          <span class="text-slate-500 block">${a.quantity} units</span>
        </div>
      </div>
    `).join('');
  } else {
    banner.classList.add('hidden');
  }
}

// Utility HTML escape
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// Modal Handlers
window.openDispenseModal = function(id, name, available) {
  document.getElementById('dispenseMedId').value = id;
  document.getElementById('dispenseMedName').innerText = name;
  document.getElementById('dispenseSellableAvailable').innerText = available;
  document.getElementById('dispenseQtyInput').max = available;
  document.getElementById('dispenseQtyInput').value = 1;
  document.getElementById('dispensePatientInput').value = '';
  document.getElementById('dispenseModal').classList.remove('hidden');
};

window.openBatchModal = function(id, name) {
  document.getElementById('newBatchMedId').value = id;
  document.getElementById('newBatchMedName').innerText = name;
  document.getElementById('newBatchNumInput').value = '';
  document.getElementById('newBatchQtyInput').value = 50;
  document.getElementById('newBatchDateInput').value = '';
  document.getElementById('newBatchModal').classList.remove('hidden');
};

// Event Listeners
document.getElementById('closeDispenseModalBtn').addEventListener('click', () => {
  document.getElementById('dispenseModal').classList.add('hidden');
});
document.getElementById('closeNewMedModalBtn').addEventListener('click', () => {
  document.getElementById('newMedModal').classList.add('hidden');
});
document.getElementById('closeNewBatchModalBtn').addEventListener('click', () => {
  document.getElementById('newBatchModal').classList.add('hidden');
});
document.getElementById('openNewMedModalBtn').addEventListener('click', () => {
  document.getElementById('newMedNameInput').value = '';
  document.getElementById('newMedCategoryInput').value = '';
  document.getElementById('newMedModal').classList.remove('hidden');
});

// Search and Sort
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage = 1;
    loadInventory();
  }, 300);
});

document.getElementById('sortSelect').addEventListener('change', () => {
  currentPage = 1;
  loadInventory();
});

document.getElementById('prevPageBtn').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadInventory();
  }
});

document.getElementById('nextPageBtn').addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadInventory();
  }
});

// Forms
document.getElementById('dispenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dispenseMedId').value;
  const quantity = parseInt(document.getElementById('dispenseQtyInput').value);
  const patientName = document.getElementById('dispensePatientInput').value;

  try {
    const res = await fetch(`/api/medicines/${id}/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, patientName })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    const breakdownMsg = result.breakdown.map(b => `${b.batchNumber} (${b.deducted}u)`).join(', ');
    showToast(`Dispensed via FEFO: ${breakdownMsg}`);
    document.getElementById('dispenseModal').classList.add('hidden');
    loadInventory();
    loadAlerts();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('newMedForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('newMedNameInput').value;
  const category = document.getElementById('newMedCategoryInput').value;

  try {
    const res = await fetch('/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category })
    });
    if (!res.ok) throw new Error('Could not add medicine');
    showToast('Medicine registered successfully');
    document.getElementById('newMedModal').classList.add('hidden');
    loadInventory();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('newBatchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('newBatchMedId').value;
  const batchNumber = document.getElementById('newBatchNumInput').value;
  const quantity = document.getElementById('newBatchQtyInput').value;
  const expiryDate = document.getElementById('newBatchDateInput').value;

  try {
    const res = await fetch(`/api/medicines/${id}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNumber, quantity, expiryDate })
    });
    if (!res.ok) throw new Error('Could not save batch');
    showToast('Batch stocked successfully');
    document.getElementById('newBatchModal').classList.add('hidden');
    loadInventory();
    loadAlerts();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
});

// Boot
verifySession();
loadInventory();
loadAlerts();