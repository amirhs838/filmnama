import { isIP, BlockList } from 'node:net';
import { Config } from '../infrastructure/config';

export function ipMatcher(entries: string[]): (ip: string) => boolean {
  const list = new BlockList();
  for (const entry of entries) {
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address ?? '');
    if (!address || !family || extra !== undefined) throw new Error('Invalid network configuration');
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) list.addAddress(address, type);
    else {
      if (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)) throw new Error('Invalid network configuration');
      list.addSubnet(address, Number(prefix), type);
    }
  }
  return (ip) => {
    const address = ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
    const family = isIP(address);
    return family !== 0 && list.check(address, family === 4 ? 'ipv4' : 'ipv6');
  };
}

export function validateRuntimeConfig(config: Config) {
  ipMatcher(config.proxies);
  ipMatcher(config.adminIps);
  if (config.production && config.value.SWAGGER_ENABLED === 'true') throw new Error('Invalid runtime configuration');
}

export function loadConfig(): Config {
  try {
    const config = new Config();
    validateRuntimeConfig(config);
    return config;
  } catch {
    throw new Error('Invalid server configuration');
  }
}
