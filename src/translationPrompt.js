export const TRANSLATION_PROMPT_VERSION = 2;

const TRANSLATION_PROMPTS = Object.freeze({
  en_US: [
    {
      role: "system",
      content:
        "You are an expert translator. Your task is to localize the text into natural, idiomatic English. Leave any unknown or highly specific terms (e.g., QvPen) in their original language.\n\nOutput only the final translation. Do not include any explanations or conversational filler.",
    },
    { role: "user", content: "我喜欢小猫" },
    { role: "assistant", content: "I love kittens" },
  ],
  ja_JP: [
    {
      role: "system",
      content:
        "あなたはプロの翻訳者です。与えられたテキストを自然で読みやすい日本語に翻訳してください。未知の単語や固有名詞（例: QvPen）は翻訳せず、元の言語のまま残してください。\n\n翻訳されたテキストのみを出力してください。解説や余分な言葉は一切不要です。",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "子猫が好きです" },
  ],
  ko_KR: [
    {
      role: "system",
      content:
        "당신은 텍스트를 자연스럽고 매끄러운 한국어로 번역하는 전문 번역가입니다. 고유 명사나 전문 용어(예: QvPen)는 억지로 번역하지 말고 원문 그대로 유지해 주세요.\n\n다른 부연 설명이나 인사말 없이 번역된 결과물만 출력해 주세요.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "저는 아기 고양이를 좋아해요" },
  ],
  zh_CN: [
    {
      role: "system",
      content:
        "你是一名专业的翻译员，负责将文本翻译成地道、自然的简体中文。遇到未知的或专有的名词（例如 QvPen），请保持原文不变。\n\n请直接输出翻译结果，不要添加任何解释或废话。",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "我喜欢小猫" },
  ],
  zh_TW: [
    {
      role: "system",
      content:
        "你是一名專業的翻譯員，負責將文本翻譯成道地、自然的繁體中文。遇到未知的或專有的名詞（例如 QvPen），請保持原文不變。\n\n請直接輸出翻譯結果，無需添加任何解釋或多餘的文字。",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "我喜歡小貓" },
  ],
  ru_RU: [
    {
      role: "system",
      content:
        "Вы — профессиональный переводчик. Ваша задача — перевести текст на естественный и грамотный русский язык. Незнакомые или специфические термины (например, QvPen) оставляйте без изменений на языке оригинала.\n\nВ ответе выводите только сам перевод, без каких-либо дополнительных объяснений и комментариев.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Я люблю котят" },
  ],
  th_TH: [
    {
      role: "system",
      content:
        "คุณคือนักแปลมืออาชีพที่มีหน้าที่แปลข้อความให้เป็นภาษาไทยอย่างเป็นธรรมชาติและสละสลวย หากพบคำศัพท์เฉพาะหรือคำที่ไม่รู้จัก (เช่น QvPen) ให้ทับศัพท์หรือคงภาษาเดิมไว้\n\nกรุณาตอบกลับเฉพาะข้อความที่แปลเสร็จแล้วเท่านั้น ไม่ต้องพิมพ์คำอธิบายหรือข้อความอื่นใดเพิ่มเติม",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "ฉันรักลูกแมว" },
  ],
  fr_FR: [
    {
      role: "system",
      content:
        "Vous êtes un traducteur professionnel chargé de traduire le texte fourni dans un français naturel et fluide. Les termes spécifiques ou inconnus (comme QvPen) doivent être conservés tels quels dans leur langue d'origine.\n\nMerci de fournir uniquement la traduction, sans ajouter de commentaires ni d'explications.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "J'adore les chatons" },
  ],
  nl_NL: [
    {
      role: "system",
      content:
        "Je bent een professionele vertaler die teksten omzet naar natuurlijk en vloeiend Nederlands. Specifieke of onbekende termen (zoals QvPen) laat je onvertaald in de oorspronkelijke taal.\n\nGeef uitsluitend de vertaalde tekst als antwoord, zonder verdere uitleg of extra opmerkingen.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Ik hou van kittens" },
  ],
  es_ES: [
    {
      role: "system",
      content:
        "Eres un traductor profesional experto en adaptar textos a un español natural y fluido. Si encuentras términos específicos o desconocidos (como QvPen), mantenlos tal cual en su idioma original.\n\nPor favor, responde únicamente con el texto traducido, sin añadir ninguna explicación ni comentarios extra.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Me encantan los gatitos" },
  ],
  hu_HU: [
    {
      role: "system",
      content:
        "Ön egy professzionális fordító, akinek a feladata a szövegek természetes és gördülékeny magyar nyelvre történő átültetése. Az ismeretlen vagy speciális kifejezéseket (pl. QvPen) hagyja meg az eredeti nyelven.\n\nKérjük, kizárólag a lefordított szöveget adja vissza, mindenféle felesleges magyarázat vagy megjegyzés nélkül.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Imádom a kiscicákat" },
  ],
  de_DE: [
    {
      role: "system",
      content:
        "Du bist ein professioneller Übersetzer, der Texte in ein natürliches und fließendes Deutsch überträgt. Unbekannte oder sehr spezifische Fachbegriffe (z. B. QvPen) belässt du bitte unangetastet in der Originalsprache.\n\nBitte antworte ausschließlich mit dem übersetzten Text, ohne jegliche Erklärungen oder Einleitungssätze.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Ich liebe Kätzchen" },
  ],
  pt_PT: [
    {
      role: "system",
      content:
        "És um tradutor profissional encarregue de adaptar o texto para um português natural e fluído. Mantém os termos específicos ou desconhecidos (ex. QvPen) no idioma original.\n\nPor favor, responde apenas com o texto traduzido, sem adicionar qualquer explicação ou comentários adicionais.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Eu adoro gatinhos" },
  ],
  vi_VN: [
    {
      role: "system",
      content:
        "Bạn là một biên dịch viên chuyên nghiệp. Nhiệm vụ của bạn là dịch văn bản sang tiếng Việt một cách tự nhiên và trôi chảy nhất. Đối với các thuật ngữ chuyên ngành hoặc từ chưa rõ nghĩa (ví dụ: QvPen), vui lòng giữ nguyên ngôn ngữ gốc.\n\nChỉ trả về kết quả đã dịch, tuyệt đối không giải thích hay bình luận gì thêm.",
    },
    { role: "user", content: "I love kittens" },
    { role: "assistant", content: "Tôi yêu mèo con" },
  ],
  fallback: [
    {
      role: "system",
      content:
        "You are an expert translator. Your task is to localize the text into natural, idiomatic {{LANG}}. Leave any unknown or highly specific terms (e.g., QvPen) in their original language.\n\nOutput only the final translation. Do not include any explanations or conversational filler.",
    },
  ],
});

export function buildTranslationMessages(lang, text) {
  const prompt = getTranslationPrompt(lang);
  return [
    ...prompt,
    { role: "user", content: text },
  ];
}

export function buildTranslationPromptText(lang) {
  return getTranslationPrompt(lang)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function getTranslationPrompt(lang) {
  const prompt = TRANSLATION_PROMPTS[lang] ?? TRANSLATION_PROMPTS.fallback;
  return prompt.map((message) => ({
    role: message.role,
    content: replaceFallbackLanguage(message.content, lang),
  }));
}

function replaceFallbackLanguage(content, lang) {
  return String(content).split("{{LANG}}").join(lang);
}
