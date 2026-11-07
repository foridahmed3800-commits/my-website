#!/usr/bin/env node
/*
  make_post_pages.js
  ------------------
  blog-post-template.html থেকে blog-post-N.html পেজ বানায়, যাতে Facebook / WhatsApp /
  Telegram-এ প্রতিটা post-এর নিজের title, ছবি আর বর্ণনা দেখায়।
  কোনো package install লাগে না। শুধু Node.js 18 বা তার নতুন version লাগে।

  ব্যবহার:
    1) Supabase থেকে নতুন post-এর পেজ বানানো (GitHub Actions এটাই চালায়):
         node make_post_pages.js
    2) হাতে একটা post-এর পেজ বানানো:
         node make_post_pages.js --id 25 --title "ধৈর্য ও শুকরিয়া" --body "লেখা..." \
              --video "https://youtu.be/XXXX" --image "ar.jpg" --date 08-11-26
    3) JSON ফাইল থেকে (test করার জন্য):
         node make_post_pages.js --from-json posts.json

  নিয়ম: যে ফাইল আগে থেকেই আছে সেটা কখনো বদলায় না (--force না দিলে)।
*/
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://foridahmed3800-commits.github.io/my-website/';
const SUPABASE_URL = 'https://gzwbckukypeqkfvttbfn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FaYdMrrPX6MSsldYbDxuUQ_wPJ4AQe3'; // publishable key, শুধু পড়ার জন্য
const DEFAULT_IMAGE = 'ar.jpg';
const DEFAULT_IMAGE_SIZE = [947, 540];
const OUT_DIR = __dirname;

/* ---------- ছোট helper ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fill = (html, key, value) => html.split('{{' + key + '}}').join(value);
const isArabic = s => /[\u0600-\u06FF]{4}/.test(s);

function ytId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function isoDate(d) {
  const s = String(d || '').trim();
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}
const showDate = d => isoDate(d).split('-').reverse().join('-');

function pageFileName(post) {
  // post.link ঠিকমতো "blog-post-....html" হলে সেটাই, নইলে blog-post-<id>.html
  if (/^blog-post-[\w.-]+\.html$/.test(post.link || '')) return post.link;
  return `blog-post-${post.id}.html`;
}

/* ---------- একটা post থেকে পেজের HTML ---------- */
function buildPage(post, template) {
  const file = pageFileName(post).replace(/\.html$/, '');
  const head = String(post.title || '').replace(/[\s:：]+$/, '').trim() || `Blog Post ${post.id}`;
  const fullTitle = `${head} — FS.`;

  const paras = String(post.body || '').replace(/\r/g, '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const plain = paras.filter(p => !isArabic(p)).join(' ').replace(/\s+/g, ' ').trim().replace(/^["“”]+|["“”]+$/g, '');
  const desc = plain.length > 150 ? plain.slice(0, 150).trimEnd() + '…' : (plain || 'FS. ব্লগ থেকে একটি নতুন পোস্ট।');

  const vid = ytId(post.video);
  const img = String(post.image || '').trim();
  const absImg = img ? (/^https?:\/\//.test(img) ? img : SITE + img.replace(/^\.?\//, '')) : '';
  let ogImage, cover, extra = '';

  if (vid) {
    ogImage = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    cover = `<div class="video-wrapper">\n      <iframe src="https://www.youtube.com/embed/${vid}" title="${esc(head)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>\n    </div>`;
    extra = [
      `<meta property="og:video" content="https://www.youtube.com/embed/${vid}">`,
      `<meta property="og:video:secure_url" content="https://www.youtube.com/embed/${vid}">`,
      `<meta property="og:video:type" content="text/html">`,
      `<meta property="og:video:width" content="1200">`,
      `<meta property="og:video:height" content="675">`
    ].join('\n');
  } else {
    ogImage = absImg || SITE + DEFAULT_IMAGE;
    const coverSrc = img || DEFAULT_IMAGE;
    cover = `<div class="cover">\n      <img src="${esc(coverSrc)}" alt="${esc(head)}">\n    </div>`;
    if (!absImg) {
      extra = `<meta property="og:image:width" content="${DEFAULT_IMAGE_SIZE[0]}">\n<meta property="og:image:height" content="${DEFAULT_IMAGE_SIZE[1]}">`;
    }
  }

  const body = paras.map(p => isArabic(p)
    ? `<p class="ayah" dir="rtl" lang="ar">${esc(p)}</p>`
    : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n\n      ');

  let html = template;
  html = html.replace(/<!--TEMPLATE-HELP[\s\S]*?TEMPLATE-HELP-->\s*/, '');
  html = html.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="index, follow">');
  html = fill(html, 'TITLE', esc(fullTitle));
  html = fill(html, 'HEAD', esc(head));
  html = fill(html, 'DESC', esc(desc));
  html = fill(html, 'OGIMAGE', esc(ogImage));
  html = fill(html, 'OG_EXTRA', extra);
  html = fill(html, 'FILE', file);
  html = fill(html, 'ISODATE', isoDate(post.date));
  html = fill(html, 'DATE', showDate(post.date));
  html = fill(html, 'COVER', cover);
  html = fill(html, 'BODY', body || '<p></p>');
  return html;
}

/* ---------- post-এর তালিকা কোথা থেকে আসবে ---------- */
async function fetchSupabasePosts() {
  const url = `${SUPABASE_URL}/rest/v1/blog_posts?select=id,date,title,body,image,video,link&published=eq.true&order=id.desc`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Supabase থেকে post আনা গেল না (HTTP ${res.status}). blog_posts table আর SQL ঠিক আছে কিনা দেখুন।`);
  return res.json();
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[k] = true;
    else { a[k] = next; i++; }
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const templatePath = path.join(OUT_DIR, 'blog-post-template.html');
  if (!fs.existsSync(templatePath)) throw new Error('blog-post-template.html পাওয়া যায়নি। ফাইলটা এই script-এর পাশে রাখুন।');
  const template = fs.readFileSync(templatePath, 'utf8');

  let posts;
  if (args.id) {
    posts = [{ id: args.id, date: args.date, title: args.title, body: args.body, video: args.video, image: args.image, link: '' }];
  } else if (args['from-json']) {
    posts = JSON.parse(fs.readFileSync(args['from-json'], 'utf8'));
  } else {
    posts = await fetchSupabasePosts();
  }

  let made = 0, skipped = 0;
  for (const post of posts) {
    if (!post || post.id === undefined || post.id === null || post.id === '') continue;
    const name = pageFileName(post);
    const target = path.join(OUT_DIR, name);
    if (fs.existsSync(target) && !args.force) { skipped++; continue; }
    fs.writeFileSync(target, buildPage(post, template), 'utf8');
    console.log('বানানো হয়েছে:', name);
    made++;
  }
  console.log(`শেষ। নতুন ${made}টা, আগে থেকে ছিল ${skipped}টা।`);
}

main().catch(e => { console.error('ত্রুটি:', e.message); process.exit(1); });
