import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'tech.tholkenbrink.speedtictactoe',
  appName: 'Speed Tic Tac Toe',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b1220',
  },
}

export default config
