const SUPABASE_URL = "https://fpwucoinxomhvtqrpabw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_F8ON8ZRtSct2f44fgEuNHw_yVsaFyjj";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let allProducts = [];
let currentConversation = null;
let messageChannel = null;

const $ = (id) => document.getElementById(id);

function toast(message) {
  const box = $("toast");
  if (!box) return;

  box.textContent = message;
  box.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    box.classList.remove("show");
  }, 2800);
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function money(value) {
  return `${Number(value || 0).toLocaleString("fa-AF")} افغانی`;
}

/* -------------------------
   PAGE NAVIGATION
------------------------- */

function showPage(name) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active-page");
  });

  const page = $(name + "Page");

  if (page) {
    page.classList.add("active-page");
  }

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === name
    );
  });

  const nav = $("mainNav");
  if (nav) nav.classList.remove("open");

  if (name === "home") {
    loadProducts();
  }

  if (name === "search") {
    renderSearch();
  }

  if (name === "favorites") {
    renderFavorites();
  }

  if (name === "account") {
    updateAccountUI();
  }

  if (name === "chat") {
    loadConversations();
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");

  if (button) {
    showPage(button.dataset.page);
  }
});

if ($("menuBtn")) {
  $("menuBtn").addEventListener("click", () => {
    $("mainNav").classList.toggle("open");
  });
}

/* -------------------------
   AUTH
------------------------- */

async function getUser() {
  const { data, error } = await db.auth.getUser();

  if (error) {
    console.error(error);
    currentUser = null;
  } else {
    currentUser = data.user || null;
  }

  await updateAccountUI();
}

async function updateAccountUI() {
  const status = $("accountStatus");
  const profileForm = $("profileForm");
  const authForm = $("authForm");
  const logoutBtn = $("logoutBtn");

  if (!status) return;

  if (!currentUser) {
    status.innerHTML =
      `<p class="muted">وارد حساب نشده‌ای.</p>`;

    if (profileForm) profileForm.hidden = true;
    if (authForm) authForm.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;

    return;
  }

  status.innerHTML =
    `<p>وارد شده‌ای با <strong>${esc(currentUser.email || "")}</strong></p>`;

  if (profileForm) profileForm.hidden = false;
  if (authForm) authForm.hidden = true;
  if (logoutBtn) logoutBtn.hidden = false;

  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (data) {
    if ($("displayName")) {
      $("displayName").value = data.display_name || "";
    }

    if ($("profileCity")) {
      $("profileCity").value = data.city || "";
    }
  }
}

/* Login */

if ($("authForm")) {
  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast(error.message);
      return;
    }

    toast("ورود موفق بود ✅");

    await getUser();
    await loadProducts();
  });
}

/* Signup */

if ($("signupBtn")) {
  $("signupBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email) {
      toast("ایمیل را وارد کن.");
      return;
    }

    if (password.length < 6) {
      toast("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password
    });

    if (error) {
      toast(error.message);
      return;
    }

    if (data.user) {
      await db.from("profiles").upsert({
        id: data.user.id,
        display_name: "کاربر بازارچه"
      });
    }

    toast(
      "ثبت‌نام انجام شد. اگر ایمیل تأیید آمد، آن را تأیید کن."
    );
  });
}

/* Logout */

if ($("logoutBtn")) {
  $("logoutBtn").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      toast(error.message);
      return;
    }

    currentUser = null;

    toast("از حساب خارج شدی.");

    await updateAccountUI();
    await loadProducts();
  });
}

/* Password reset */

if ($("resetBtn")) {
  $("resetBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();

    if (!email) {
      toast("ابتدا ایمیلت را وارد کن.");
      return;
    }

    const redirectTo =
      window.location.origin + window.location.pathname;

    const { error } =
      await db.auth.resetPasswordForEmail(email, {
        redirectTo
      });

    if (error) {
      toast(error.message);
      return;
    }

    toast("لینک تغییر رمز به ایمیل فرستاده شد.");
  });
}

/* Auth state */

db.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;

  await updateAccountUI();
});

/* -------------------------
   PROFILE
------------------------- */

if ($("profileForm")) {
  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      toast("ابتدا وارد حساب شو.");
      return;
    }

    const displayName =
      $("displayName").value.trim() ||
      "کاربر بازارچه";

    const city =
      $("profileCity").value || null;

    const { error } = await db
      .from("profiles")
      .upsert({
        id: currentUser.id,
        display_name: displayName,
        city
      });

    if (error) {
      console.error(error);
      toast("پروفایل ذخیره نشد.");
      return;
    }

    toast("پروفایل ذخیره شد ✅");
  });
}

/* -------------------------
   PRODUCTS
------------------------- */

async function loadProducts() {
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(error);
    toast("خطا در دریافت آگهی‌ها.");
    return;
  }

  allProducts = data || [];

  renderProductList(
    allProducts.slice(0, 12),
    $("homeProducts")
  );

  await renderSearch();
  await renderFavorites();
}

function productCard(product, favoriteIds = new Set()) {
  const isMine =
    currentUser &&
    currentUser.id === product.user_id;

  let image;

  if (product.image_url) {
    image = `
      <img
        class="product-img"
        src="${esc(product.image_url)}"
        alt="${esc(product.title)}"
        loading="lazy"
      >
    `;
  } else {
    image = `
      <div class="placeholder">
        🛍️
      </div>
    `;
  }

  return `
    <article class="product-card">

      ${image}

      <div class="product-body">

        <h3>
          ${esc(product.title)}
        </h3>

        <div class="price">
          ${money(product.price)}
        </div>

        <div class="meta">
          📍 ${esc(product.city || "نامشخص")}
          ·
          ${esc(product.category || "سایر")}
        </div>

        <p class="desc">
          ${esc(
            (product.description || "").slice(0, 100)
          )}
        </p>

        <div class="card-actions">

          <button
            class="small-btn secondary"
            data-fav="${product.id}"
          >
            ${
              favoriteIds.has(product.id)
                ? "★ ذخیره شد"
                : "☆ علاقه‌مندی"
            }
          </button>

          ${
            !isMine
              ? `
                <button
                  class="small-btn primary"
                  data-chat="${product.id}"
                >
                  💬 چت
                </button>
              `
              : `
                <button
                  class="small-btn danger"
                  data-delete="${product.id}"
                >
                  حذف
                </button>
              `
          }

        </div>

      </div>

    </article>
  `;
}

function renderProductList(products, container) {
  if (!container) return;

  if (!products.length) {
    container.innerHTML =
      `<div class="empty">آگهی‌ای پیدا نشد.</div>`;
    return;
  }

  container.innerHTML =
    products.map((product) =>
      productCard(product)
    ).join("");
}

/* -------------------------
   FAVORITES
------------------------- */

async function getFavoriteIds() {
  if (!currentUser) {
    return new Set();
  }

  const { data, error } = await db
    .from("favorites")
    .select("product_id")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    return new Set();
  }

  return new Set(
    (data || []).map((item) => item.product_id)
  );
}

async function renderFavorites() {
  const container = $("favoriteProducts");

  if (!container) return;

  if (!currentUser) {
    container.innerHTML =
      `<div class="empty">
        برای دیدن علاقه‌مندی‌ها ابتدا وارد حساب شو.
      </div>`;
    return;
  }

  const favoriteIds =
    await getFavoriteIds();

  const products =
    allProducts.filter((product) =>
      favoriteIds.has(product.id)
    );

  if (!products.length) {
    container.innerHTML =
      `<div class="empty">
        هنوز آگهی‌ای ذخیره نکرده‌ای.
      </div>`;
    return;
  }

  container.innerHTML =
    products.map((product) =>
      productCard(product, favoriteIds)
    ).join("");
}

/* Favorite / delete / chat buttons */

document.addEventListener("click", async (event) => {

  /* Favorite */

  const favoriteButton =
    event.target.closest("[data-fav]");

  if (favoriteButton) {

    if (!currentUser) {
      toast("ابتدا وارد حساب شو.");
      showPage("account");
      return;
    }

    const productId =
      Number(favoriteButton.dataset.fav);

    const { data: existing } =
      await db
        .from("favorites")
        .select("product_id")
        .eq("user_id", currentUser.id)
        .eq("product_id", productId)
        .maybeSingle();

    if (existing) {

      await db
        .from("favorites")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("product_id", productId);

      toast("از علاقه‌مندی حذف شد.");

    } else {

      const { error } =
        await db
          .from("favorites")
          .insert({
            user_id: currentUser.id,
            product_id: productId
          });

      if (error) {
        console.error(error);
        toast("ذخیره نشد.");
        return;
      }

      toast("به علاقه‌مندی اضافه شد ⭐");
    }

    await loadProducts();
    return;
  }

  /* Delete */

  const deleteButton =
    event.target.closest("[data-delete]");

  if (deleteButton) {

    if (!currentUser) return;

    const productId =
      Number(deleteButton.dataset.delete);

    const { error } =
      await db
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("user_id", currentUser.id);

    if (error) {
      console.error(error);
      toast("آگهی حذف نشد.");
      return;
    }

    toast("آگهی حذف شد.");

    await loadProducts();
    return;
  }

  /* Chat */

  const chatButton =
    event.target.closest("[data-chat]");

  if (chatButton) {

    const productId =
      Number(chatButton.dataset.chat);

    await startChat(productId);
  }
});

/* -------------------------
   SEARCH
------------------------- */

async function renderSearch() {

  const container = $("searchProducts");

  if (!container) return;

  const input =
    $("searchInput")?.value
      .trim()
      .toLowerCase() || "";

  const category =
    $("categoryFilter")?.value || "";

  const city =
    $("cityFilter")?.value || "";

  const products =
    allProducts.filter((product) => {

      const text =
        `${product.title || ""} ${product.description || ""}`
          .toLowerCase();

      return (
        (!input || text.includes(input)) &&
        (!category || product.category === category) &&
        (!city || product.city === city)
      );
    });

  const favoriteIds =
    await getFavoriteIds();

  if (!products.length) {
    container.innerHTML =
      `<div class="empty">
        نتیجه‌ای پیدا نشد.
      </div>`;
    return;
  }

  container.innerHTML =
    products.map((product) =>
      productCard(product, favoriteIds)
    ).join("");
}

["searchInput", "categoryFilter", "cityFilter"]
  .forEach((id) => {

    const element = $(id);

    if (!element) return;

    element.addEventListener(
      "input",
      renderSearch
    );

    element.addEventListener(
      "change",
      renderSearch
    );
  });

/* -------------------------
   ADD PRODUCT
------------------------- */

if ($("productForm")) {

  $("productForm").addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      if (!currentUser) {
        toast(
          "برای ثبت آگهی ابتدا وارد حساب شو."
        );

        showPage("account");
        return;
      }

      const product = {
        user_id: currentUser.id,

        title:
          $("productTitle").value.trim(),

        price:
          Number($("productPrice").value),

        category:
          $("productCategory").value,

        city:
          $("productCity").value,

        description:
          $("productDescription").value.trim(),

        image_url:
          $("productImage").value.trim() || null,

        status: "active"
      };

      if (!product.title) {
        toast("عنوان آگهی را وارد کن.");
        return;
      }

      if (!product.category) {
        toast("دسته‌بندی را انتخاب کن.");
        return;
      }

      if (!product.city) {
        toast("شهر را انتخاب کن.");
        return;
      }

      const { error } =
        await db
          .from("products")
          .insert(product);

      if (error) {
        console.error(error);
        toast("آگهی ثبت نشد.");
        return;
      }

      $("productForm").reset();

      toast("آگهی با موفقیت ثبت شد ✅");

      await loadProducts();

      showPage("home");
    }
  );
}

/* -------------------------
   CHAT
------------------------- */

async function startChat(productId) {

  if (!currentUser) {
    toast("برای چت ابتدا وارد حساب شو.");
    showPage("account");
    return;
  }

  const product =
    allProducts.find(
      (item) => item.id === productId
    );

  if (!product) return;

  if (product.user_id === currentUser.id) {
    toast("این آگهی متعلق به خودت است.");
    return;
  }

  let { data: conversation } =
    await db
      .from("conversations")
      .select("*")
      .eq("product_id", productId)
      .eq("buyer_id", currentUser.id)
      .eq("seller_id", product.user_id)
      .maybeSingle();

  if (!conversation) {

    const result =
      await db
        .from("conversations")
        .insert({
          product_id: productId,
          buyer_id: currentUser.id,
          seller_id: product.user_id
        })
        .select()
        .single();

    if (result.error) {
      console.error(result.error);
      toast("ساخت گفتگو ممکن نشد.");
      return;
    }

    conversation = result.data;
  }

  currentConversation = conversation;

  showPage("chat");

  await loadConversations();

  await openConversation(conversation);
}

/* Load conversations */

async function loadConversations() {

  const box =
    $("conversationList");

  if (!box) return;

  if (!currentUser) {
    box.innerHTML =
      `<p class="muted">
        برای دیدن گفتگوها وارد حساب شو.
      </p>`;
    return;
  }

  const { data, error } =
    await db
      .from("conversations")
      .select(`
        id,
        product_id,
        buyer_id,
        seller_id,
        created_at,
        products(title)
      `)
      .or(
        `buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`
      )
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);

    box.innerHTML =
      `<p class="muted">
        خطا در دریافت گفتگوها.
      </p>`;

    return;
  }

  if (!data?.length) {
    box.innerHTML =
      `<p class="muted">
        هنوز گفتگویی نداری.
      </p>`;

    return;
  }

  window.conversationsCache = data;

  box.innerHTML =
    data.map((conversation) => `
      <div
        class="conversation-item ${
          currentConversation?.id === conversation.id
            ? "selected"
            : ""
        }"
        data-conversation="${conversation.id}"
      >

        <strong>
          ${esc(
            conversation.products?.title ||
            "گفتگو"
          )}
        </strong>

        <div class="meta">
          ${
            conversation.buyer_id === currentUser.id
              ? "خریدار"
              : "فروشنده"
          }
        </div>

      </div>
    `).join("");
}

/* Open conversation */

document.addEventListener("click", (event) => {

  const item =
    event.target.closest(
      "[data-conversation]"
    );

  if (!item) return;

  const conversation =
    (window.conversationsCache || [])
      .find(
        (item) =>
          item.id ===
          Number(
            event.currentTarget?.dataset?.conversation ||
            event.target.closest("[data-conversation]")?.dataset.conversation
          )
      );

  if (conversation) {
    openConversation(conversation);
  }
});

async function openConversation(conversation) {

  currentConversation = conversation;

  if ($("chatHeader")) {
    $("chatHeader").textContent =
      `💬 ${
        conversation.products?.title ||
        "گفتگو"
      }`;
  }

  document
    .querySelectorAll(".conversation-item")
    .forEach((item) => {

      item.classList.toggle(
        "selected",
        Number(item.dataset.conversation) ===
        conversation.id
      );
    });

  const { data, error } =
    await db
      .from("messages")
      .select("*")
      .eq(
        "conversation_id",
        conversation.id
      )
      .order("created_at", {
        ascending: true
      });

  if (error) {
    console.error(error);
    toast("پیام‌ها دریافت نشد.");
    return;
  }

  renderMessages(data || []);

  if (messageChannel) {
    await db.removeChannel(
      messageChannel
    );
  }

  messageChannel =
    db
      .channel(
        `messages-${conversation.id}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            `conversation_id=eq.${conversation.id}`
        },
        (payload) => {

          const message =
            payload.new;

          if (
            !document.querySelector(
              `[data-message-id="${message.id}"]`
            )
          ) {
            appendMessage(message);
          }
        }
      )
      .subscribe();
}

/* Conversation click */

document.addEventListener("click", (event) => {

  const item =
    event.target.closest(
      ".conversation-item"
    );

  if (!item) return;

  const conversation =
    (window.conversationsCache || [])
      .find(
        (itemData) =>
          itemData.id ===
          Number(item.dataset.conversation)
      );

  if (conversation) {
    openConversation(conversation);
  }
});

/* Render messages */

function renderMessages(messages) {

  const container =
    $("messages");

  if (!container) return;

  container.innerHTML =
    messages
      .map(messageHtml)
      .join("");

  container.scrollTop =
    container.scrollHeight;
}

function messageHtml(message) {

  const mine =
    currentU