const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const ICON_FILE = 'shortcut_sos.xml';

module.exports = function withSosShortcutIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const source = path.join(cfg.modRequest.projectRoot, 'native-assets', ICON_FILE);
      const drawableDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(source, path.join(drawableDir, ICON_FILE));
      return cfg;
    },
  ]);
};
