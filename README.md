# tutu AR

QRの位置・傾きに追従して、tutuの手振りアニメーションを再生するWeb試作。

## 起動

```sh
npm ci
npm run dev
```

PCでは http://localhost:5173 を開く。スマホのカメラ利用はHTTPSで配信すること。LANのHTTPアドレスではカメラを利用できない。

`/?marker` を別の画面で開くか印刷し、AR画面のカメラにQR全体を映す。ページを開いた直後に背面カメラの使用許可を要求する。拒否や起動失敗時は再起動ボタンを表示する。

## QRに入れるデータ

標準は `tutu:wave`。`手を振る` または `{"character":"tutu","action":"wave"}` も利用可能。

動画やGLBはQRに埋め込まず、Web側のモデルを選ぶ指示だけを格納する。未知のQRやURLは実行しない。

## 表示と制限

- jsQRで約10回/秒解析し、QR四隅のホモグラフィから姿勢を推定。QRの中心を足元として立つ。
- 四隅の座標を適応的に平滑化し、微小な位置・角度の変化と一時的な大ジャンプを抑制する。QRが小さすぎる場合（解析画像で一辺38px未満）は姿勢更新を見送る。
- 800ms検出が途切れたら非表示。短い検出途切れでは姿勢を保持し、アニメーションを巻き戻さない。
- カメラの焦点距離は推定値。端末の校正やSLAMは行わないため、強い傾きやレンズ歪みによるズレ・揺れがありうる。QRが見えない間も空間に固定する方式ではない。
- カメラ映像の解析はブラウザ内。映像のアップロード処理はない。
- オリジナルGLBは変更しない。`node optimize.mjs` でWeb用モデルを生成する。
- 実機カメラの許可、姿勢追従、表示方向、速度はiPhone Safari / Android Chromeで確認すること。

## 検証とビルド

```sh
npm test
npm run build
```

## GitHub Pages

リポジトリの Settings → Pages → Build and deployment で Source を **GitHub Actions** にする。
`main` へpushすると `.github/workflows/pages.yml` がテスト・ビルド・デプロイを実行する。Actions画面から手動実行も可能。

Viteの `base: './'` により `/リポジトリ名/` 配下でもJS・CSS・GLBを読み込める。
公開URLの末尾に `?marker` を付けると読み取り用QRを表示する。GitHub PagesのHTTPS URLならスマホでもカメラを利用できる。
