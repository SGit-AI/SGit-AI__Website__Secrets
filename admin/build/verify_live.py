# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Verify__Live
# The verify-live job: green does not mean live. Polls the live site's
# admin/build/version.txt and the homepage version badge, with a cache-buster,
# until both equal the released version or the timeout passes. A deploy whose
# bytes nobody can read is not a release, so the run fails loudly otherwise.
# Usage: python3 admin/build/verify_live.py --version 0.1.0 [--base https://secrets.sgit.ai] [--timeout 600] [--interval 15]
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys
import time
import urllib.error
import urllib.request


class Verify__Live:

    def __init__(self, version, base='https://secrets.sgit.ai', timeout=600, interval=15):
        self.version  = version
        self.base     = base.rstrip('/')
        self.timeout  = timeout
        self.interval = interval

    def fetch(self, path):
        url     = f'{self.base}{path}?t={int(time.time() * 1000)}'
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'User-Agent': 'secrets-sgit-ai-verify-live'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.read().decode('utf-8', 'replace'), None
        except urllib.error.HTTPError as error:
            return None, f'HTTP {error.code}'
        except Exception as error:                                                # DNS not yet pointing, TLS not yet issued, connection refused
            return None, f'{type(error).__name__}: {error}'

    def observe(self):
        version_text, version_error = self.fetch('/admin/build/version.txt')
        home_text,    home_error    = self.fetch('/')
        served_version = version_text.strip() if version_text else None
        badge          = re.search(r'data-version="([^"]+)"', home_text) if home_text else None
        served_badge   = badge.group(1) if badge else None
        return served_version, version_error, served_badge, home_error

    def run(self):
        print(f'waiting for v{self.version} to be served at {self.base} (up to {self.timeout}s)')
        deadline = time.time() + self.timeout
        last     = None
        while True:
            served_version, version_error, served_badge, home_error = self.observe()
            state = (served_version, version_error, served_badge, home_error)
            if state != last:
                print(f'  version.txt: {served_version or version_error}   homepage badge: {served_badge or home_error}')
                last = state
            if served_version == self.version and served_badge == self.version:
                print(f'live: {self.base} is serving v{self.version}')
                return 0
            if time.time() >= deadline:
                print(f'NOT LIVE after {self.timeout}s: {self.base} is serving version.txt={served_version or version_error}, '
                      f'badge={served_badge or home_error}, expected v{self.version}.')
                print('Green does not mean live. If the deploy job succeeded, the domain, DNS or Pages configuration is wrong '
                      '(see docs/ops/needs.md); if the deploy failed on an action download (429), re-run the workflow.')
                return 1
            time.sleep(self.interval)


if __name__ == '__main__':
    args = sys.argv[1:]

    def option(name, default):
        return args[args.index(name) + 1] if name in args else default

    if '--version' not in args:
        print('usage: verify_live.py --version X.Y.Z [--base URL] [--timeout SECONDS] [--interval SECONDS]')
        sys.exit(2)
    sys.exit(Verify__Live(version  = option('--version', None),
                          base     = option('--base', 'https://secrets.sgit.ai'),
                          timeout  = int(option('--timeout', '600')),
                          interval = int(option('--interval', '15'))).run())
