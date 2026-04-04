export const DISCORD_COMMANDS = [
  {
    name: "help",
    description: "利用可能なコマンド一覧を表示します。",
    type: 1,
  },
  {
    name: "status",
    description: "翻訳サービスの現在設定を表示します。",
    type: 1,
  },
  {
    name: "service",
    description: "翻訳サービスの起動状態を切り替えます。",
    type: 1,
    options: [
      {
        type: 3,
        name: "action",
        description: "on で起動、off で停止します。",
        required: true,
        choices: [
          { name: "起動", value: "on" },
          { name: "停止", value: "off" },
        ],
      },
    ],
  },
  {
    name: "limit",
    description: "IP ごとの 1 分あたり要求数を変更します。",
    type: 1,
    options: [
      {
        type: 4,
        name: "requests_per_minute",
        description: "1 から 60 の整数です。",
        required: true,
        min_value: 1,
        max_value: 60,
      },
    ],
  },
  {
    name: "maxchars",
    description: "翻訳テキストの最大文字数を変更します。",
    type: 1,
    options: [
      {
        type: 4,
        name: "value",
        description: "1 から 1000 の整数です。",
        required: true,
        min_value: 1,
        max_value: 1000,
      },
    ],
  },
  {
    name: "prompt",
    description: "翻訳用 prompt を更新します。",
    type: 1,
    options: [
      {
        type: 3,
        name: "text",
        description: "新しい prompt 文字列です。",
        required: true,
        min_length: 1,
        max_length: 4000,
      },
    ],
  },
  {
    name: "errors",
    description: "最近のエラーログを表示します。",
    type: 1,
    options: [
      {
        type: 4,
        name: "limit",
        description: "1 から 10 の整数です。",
        required: false,
        min_value: 1,
        max_value: 10,
      },
    ],
  },
  {
    name: "ping",
    description: "AI 上流APIへの疎通と遅延を確認します。",
    type: 1,
  },
  {
    name: "simulate",
    description: "翻訳APIの処理を手動で疑似実行します。",
    type: 1,
    options: [
      {
        type: 3,
        name: "lang",
        description: "翻訳先言語コードです。",
        required: true,
        min_length: 1,
        max_length: 32,
      },
      {
        type: 3,
        name: "text",
        description: "翻訳したい本文です。",
        required: true,
        min_length: 1,
        max_length: 300,
      },
    ],
  },
  {
    name: "resetcache",
    description: "translation_cache のレコードを全削除します。",
    type: 1,
  },
  {
    name: "stats",
    description: "当日と当月の翻訳統計を表示します。",
    type: 1,
  },
];
