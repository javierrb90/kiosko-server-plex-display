export function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadItemsCsv({ rows = [], filename = 'kiosko-items.csv', ratingFor = () => '' } = {}) {
  const headers = ['title','subtitle','source','type','collectionType','status','rating','completedAt','updatedAt','canonicalId'];
  const csv = [headers.join(',')]
    .concat(rows.map(item => headers.map(key => escapeCsvValue(key === 'rating' ? ratingFor(item) : item[key])).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function itemListMarkup({ rows = [], typeLabel = item => item.collectionType || item.type || '', ratingFor = () => '', dateFor = item => item.completedAt || item.lastActivityAt || item.updatedAt || item.createdAt || '', escapeHtml, escapeAttr }) {
  const html = value => escapeHtml ? escapeHtml(value) : String(value ?? '');
  const attr = value => escapeAttr ? escapeAttr(value) : html(value);
  const date = value => {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES') : '';
  };
  return `<div class="kiosko-list" role="table">
    <div class="kiosko-list__row kiosko-list__row--head" role="row"><span>Título</span><span>Fuente</span><span>Tipo</span><span>Rating</span><span>Fecha</span></div>
    ${rows.map(item => `<button type="button" class="kiosko-list__row" data-id="${attr(item.id || item.canonicalId)}" data-source="${attr(item.source || '')}">
      <span><strong>${html(item.title || 'Sin título')}</strong><small>${html(item.subtitle || '')}</small></span>
      <span>${html(item.source || '')}</span>
      <span>${html(typeLabel(item))}</span>
      <span>${ratingFor(item) || '—'}</span>
      <span>${html(date(dateFor(item)))}</span>
    </button>`).join('')}
  </div>`;
}
