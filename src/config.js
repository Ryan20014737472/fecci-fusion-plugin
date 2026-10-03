const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function commaSeparated(value) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function readConfig(env = process.env) {
  const portText = env.PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  let allowedHosts = commaSeparated(env.ALLOWED_HOSTS).map((value) => value.toLowerCase());
  if (allowedHosts.length === 0) {
    if (host === '0.0.0.0' || host === '::') {
      throw new Error('Defina ALLOWED_HOSTS ao usar HOST=0.0.0.0 ou HOST=::.');
    }
    const hostname = host.includes(':') ? `[${host}]` : host.toLowerCase();
    allowedHosts = LOOPBACK_HOSTS.includes(hostname) ? [...LOOPBACK_HOSTS] : [hostname];
  }

  for (const hostname of allowedHosts) {
    try {
      const url = new URL(`http://${hostname}`);
      if (url.hostname !== hostname || url.port || hostname.includes('*')) {
        throw new Error();
      }
    } catch {
      throw new Error('ALLOWED_HOSTS deve conter nomes/IPs exatos, sem esquema, porta ou caminho.');
    }
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
