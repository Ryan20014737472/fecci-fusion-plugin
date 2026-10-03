const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function commaSeparated(value) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function hostname(value, variable) {
  const normalized = value.trim().toLowerCase();
  try {
    const url = new URL(`http://${normalized}`);
    if (url.hostname !== normalized || url.port || normalized.includes('*')) {
      throw new Error();
    }
  } catch {
    throw new Error(`${variable} deve conter nomes/IPs exatos, sem esquema, porta ou caminho.`);
  }
  return normalized;
}

export function readConfig(env = process.env) {
  const portText = env.PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }

  const host = env.HOST?.trim() || '0.0.0.0';
  const publicHosts = [
    ['PUBLIC_DOMAIN', env.PUBLIC_DOMAIN],
    ['RENDER_EXTERNAL_HOSTNAME', env.RENDER_EXTERNAL_HOSTNAME],
  ].filter(([, value]) => value?.trim()).map(([variable, value]) => hostname(value, variable));
  let allowedHosts = [...new Set([
    ...publicHosts,
    ...commaSeparated(env.ALLOWED_HOSTS).map((value) => hostname(value, 'ALLOWED_HOSTS')),
  ])];

  if (allowedHosts.length === 0) {
    const bindHostname = host.includes(':') ? `[${host}]` : host.toLowerCase();
    if (env.NODE_ENV === 'production' && !LOOPBACK_HOSTS.includes(bindHostname)) {
      throw new Error('Defina PUBLIC_DOMAIN, RENDER_EXTERNAL_HOSTNAME ou ALLOWED_HOSTS para escuta pública em produção.');
    }
    allowedHosts = host === '0.0.0.0' || host === '::' || LOOPBACK_HOSTS.includes(bindHostname)
      ? [...LOOPBACK_HOSTS]
      : [hostname(bindHostname, 'HOST')];
  }

  const allowedOrigins = commaSeparated(env.ALLOWED_ORIGINS);
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
        throw new Error();
      }
    } catch {
      throw new Error('ALLOWED_ORIGINS deve conter origens HTTP/HTTPS completas, sem caminho.');
    }
  }

  return { port, host, allowedHosts, allowedOrigins };
}
