export const PRESETS = {
  url: (p) => {
    if (!p.url) throw new Error('Missing required field: url');
    let url = String(p.url);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return { content: url, content_type: 'url', description: `URL: ${url}` };
  },

  text: (p) => {
    if (!p.text) throw new Error('Missing required field: text');
    return { content: String(p.text), content_type: 'text', description: `Text (${p.text.length} chars)` };
  },

  wifi: (p) => {
    if (!p.ssid) throw new Error('Missing required field: ssid');
    const enc = p.encryption || 'WPA';
    const hidden = p.hidden ? 'H:true;' : '';
    let content = `WIFI:T:${enc};S:${escapeWifi(p.ssid)};`;
    if (enc !== 'nopass' && p.password) {
      content += `P:${escapeWifi(p.password)};`;
    }
    content += `${hidden};`;
    return { content, content_type: 'wifi', description: `WiFi: ${p.ssid} (${enc})` };
  },

  vcard: (p) => {
    if (!p.first_name && !p.last_name && !p.organization) {
      throw new Error('vCard needs at least a name or organization');
    }
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${p.last_name || ''};${p.first_name || ''};;;`,
      `FN:${[p.first_name, p.last_name].filter(Boolean).join(' ') || p.organization}`,
    ];
    if (p.organization) lines.push(`ORG:${p.organization}`);
    if (p.title) lines.push(`TITLE:${p.title}`);
    if (p.phone) lines.push(`TEL;TYPE=CELL:${p.phone}`);
    if (p.email) lines.push(`EMAIL:${p.email}`);
    if (p.website) lines.push(`URL:${p.website}`);
    if (p.address) lines.push(`ADR;TYPE=WORK:;;${p.address};;;;`);
    if (p.note) lines.push(`NOTE:${p.note}`);
    lines.push('END:VCARD');

    return {
      content: lines.join('\n'),
      content_type: 'vcard',
      description: `Contact: ${p.first_name || ''} ${p.last_name || ''}`.trim() || p.organization,
    };
  },

  email: (p) => {
    if (!p.to) throw new Error('Missing required field: to');
    const params = [];
    if (p.subject) params.push(`subject=${encodeURIComponent(p.subject)}`);
    if (p.body) params.push(`body=${encodeURIComponent(p.body)}`);
    const content = `mailto:${p.to}${params.length ? '?' + params.join('&') : ''}`;
    return { content, content_type: 'email', description: `Email to ${p.to}` };
  },

  sms: (p) => {
    if (!p.to) throw new Error('Missing required field: to');
    const content = `SMSTO:${p.to}${p.body ? ':' + p.body : ''}`;
    return { content, content_type: 'sms', description: `SMS to ${p.to}` };
  },

  tel: (p) => {
    if (!p.phone) throw new Error('Missing required field: phone');
    return { content: `tel:${p.phone}`, content_type: 'tel', description: `Call ${p.phone}` };
  },

  geo: (p) => {
    if (p.lat === undefined || p.lon === undefined) {
      throw new Error('Missing required fields: lat, lon');
    }
    const content = `geo:${p.lat},${p.lon}${p.query ? '?q=' + encodeURIComponent(p.query) : ''}`;
    return { content, content_type: 'geo', description: `Geo: ${p.lat}, ${p.lon}` };
  },

  upi: (p) => {
    if (!p.vpa || !p.name) throw new Error('UPI needs "vpa" and "name"');
    const params = new URLSearchParams();
    params.set('pa', p.vpa);
    params.set('pn', p.name);
    if (p.amount) params.set('am', String(p.amount));
    if (p.note) params.set('tn', p.note);
    if (p.currency) params.set('cu', p.currency);
    const content = `upi://pay?${params.toString()}`;
    return { content, content_type: 'upi', description: `UPI to ${p.vpa}${p.amount ? ' for ' + p.amount : ''}` };
  },

  momo: (p) => {
    if (!p.phone) throw new Error('Mobile Money needs "phone"');
    const provider = p.provider || 'airtel';
    const parts = [`provider=${provider}`, `phone=${p.phone}`];
    if (p.amount) parts.push(`amount=${p.amount}`);
    if (p.currency) parts.push(`currency=${p.currency}`);
    if (p.reference) parts.push(`ref=${p.reference}`);
    const content = `momo://pay?${parts.join('&')}`;
    return { content, content_type: 'momo', description: `Mobile Money ${provider} to ${p.phone}` };
  },
};

function escapeWifi(str) {
  return String(str).replace(/([\\;,:"])/g, '\\$1');
}

export function listPresets() {
  return Object.keys(PRESETS).map((name) => ({
    name,
    fields: getPresetFields(name),
  }));
}

export function getPresetFields(name) {
  const schemas = {
    url: ['url'],
    text: ['text'],
    wifi: ['ssid', 'password?', 'encryption?', 'hidden?'],
    vcard: ['first_name?', 'last_name?', 'organization?', 'title?', 'phone?', 'email?', 'website?', 'address?', 'note?'],
    email: ['to', 'subject?', 'body?'],
    sms: ['to', 'body?'],
    tel: ['phone'],
    geo: ['lat', 'lon', 'query?'],
    upi: ['vpa', 'name', 'amount?', 'currency?', 'note?'],
    momo: ['phone', 'provider?', 'amount?', 'currency?', 'reference?'],
  };
  return schemas[name] || [];
}

export function buildPreset(presetName, payload) {
  const builder = PRESETS[presetName];
  if (!builder) throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
  return builder(payload || {});
}
