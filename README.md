# 261127a

にじのみち系 新作15本（E01〜E15）。写実3D、指1本、画面に文字なし。

- `briefs/` … 各ゲームの実装指示文（ChatGPT 作成）
- `site/games/eNN/index.html` … ゲーム本体（Claude Code Cloud / Opus 5.5 実装）
- `site/thumbs/eNN.jpg|svg` … 一覧用のサムネイル
- `logs/eNN/` … クラウド実装の記録（作業メモ・テスト結果・スクリーンショット）
- Three.js r0.187.0 を `site/vendor/three/` に同梱（MIT, LICENSE 同梱）。importmap:
  `{"three":"../../vendor/three/build/three.module.min.js","three/addons/":"../../vendor/three/examples/jsm/"}`
