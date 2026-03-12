import { supabase, getSession } from "../../supabase/index.js";

const BUCKET = "campusconnect-media";
const POST_IMAGE_PATH = "post-images";
const PROFILE_IMAGE_PATH = "profile-images";
const PLACEHOLDER_PROFILE = "../photos/placeholder-profile.webp";
let currentUserId = null;

const typeLabels = {
  story: "Stories",
  alert: "Alerts",
  update: "Announcements",
  other: "Markets",
  jobs: "Jobs",
  events: "Events",
};

const pageTypeMap = {
  "announcements.html": "update",
  "alerts.html": "alert",
  "events.html": "events",
  "stories.html": "story",
  "trends.html": "other",
  "jobs.html": "jobs",
};

const formatCount = (value) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return `${num}`;
};

const setBodyClass = (name, active) => {
  document.body.classList.toggle(name, Boolean(active));
};

const setHiUser = (fullName) => {
  const hiEl = document.querySelector(".user p");
  if (hiEl) {
    hiEl.textContent = fullName ? `Hi ${fullName}` : "Hi user";
  }
};

const setProfileImage = (url) => {
  const img = document.querySelector(".profile---image");
  if (img) {
    img.src = url || PLACEHOLDER_PROFILE;
  }
  const sidebarImages = document.querySelectorAll(".profile-infor--images");
  if (sidebarImages.length > 1) {
    sidebarImages[1].src = url || PLACEHOLDER_PROFILE;
  }
};

const setSidebarProfile = (fullName) => {
  const nameEl = document.querySelector(".name--profile");
  const usernameEl = document.querySelector(".username--profile");
  const cleanName = (fullName || "").trim();
  if (nameEl) {
    nameEl.textContent = cleanName || "User";
  }
  if (usernameEl) {
    const usernameBase = cleanName.replace(/\s+/g, "");
    usernameEl.textContent = usernameBase ? `@${usernameBase}` : "@user";
  }
};

const fetchProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
};

const ensureProfile = async (user) => {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name || "";
  const email = user.email || "";
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) return null;
  return data;
};

const loadProfile = async () => {
  const { session } = await getSession();
  if (!session) {
    setHiUser("");
    setProfileImage(PLACEHOLDER_PROFILE);
    return null;
  }
  const user = session.user;
  let profile = await fetchProfile(user.id);
  if (!profile) {
    profile = await ensureProfile(user);
  }
  if (profile) {
    setHiUser(profile.full_name || user.user_metadata?.full_name || "");
    setSidebarProfile(profile.full_name || user.user_metadata?.full_name || "");
    setProfileImage(profile.avatar_url || PLACEHOLDER_PROFILE);
    const nameInput = document.getElementById("profile-name");
    const emailInput = document.getElementById("profile-email");
    if (nameInput && profile.full_name) nameInput.value = profile.full_name;
    if (emailInput && profile.email) emailInput.value = profile.email;
  }
  return profile;
};

const uploadProfileImage = async (user, file) => {
  if (!user || !file) return null;
  const filename = `${Date.now()}_${file.name}`;
  const path = `${PROFILE_IMAGE_PATH}/${user.id}/${filename}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
};

const updateProfile = async (profile, updates) => {
  if (!profile) return null;
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", profile.user_id)
    .select()
    .single();
  if (error) return null;
  return data;
};

const renderCard = (post) => {
  const card = document.createElement("div");
  card.className = "news-card";
  card.dataset.postId = post.post_id;

  const sourceCard = document.createElement("div");
  sourceCard.className = "news-source-card";

  const authorImage = document.createElement("img");
  authorImage.className = "news-source-card--image";
  authorImage.src =
    post.visibility === "public" && post.author_photo
      ? post.author_photo
      : PLACEHOLDER_PROFILE;
  authorImage.alt = "";

  const authorContainer = document.createElement("div");
  authorContainer.className = "author-name-container";

  const authorName = document.createElement("h3");
  authorName.className = "author-name";
  authorName.textContent =
    post.visibility === "public" && post.author_name
      ? post.author_name
      : "Anonymous";

  const timestamp = document.createElement("p");
  timestamp.className = "timestamp";
  timestamp.textContent = post.created_at
    ? new Date(post.created_at).toLocaleDateString()
    : "";

  authorContainer.appendChild(authorName);
  authorContainer.appendChild(timestamp);
  sourceCard.appendChild(authorImage);
  sourceCard.appendChild(authorContainer);

  const description = document.createElement("div");
  description.className = "feed-description";

  const typeLine = document.createElement("h4");
  typeLine.innerHTML = `Feed type: <span class="span-type">${typeLabels[post.type] || post.type || "Update"}</span>`;

  const body = document.createElement("p");
  body.className = "actual-description";
  body.textContent = post.body || post.title || "";

  description.appendChild(typeLine);
  description.appendChild(body);

  const imageDiv = document.createElement("div");
  imageDiv.className = "feed-image-div";

  const readMore = document.createElement("span");
  readMore.className = "read-more";
  readMore.textContent = "Read More";
  imageDiv.appendChild(readMore);

  if (post.image_url) {
    const img = document.createElement("img");
    img.className = "feed-image";
    img.src = post.image_url;
    img.alt = "";
    imageDiv.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "views-like-emoji";
  actions.style.display = "flex";
  actions.style.alignItems = "center";
  actions.style.justifyContent = "start";

  const views = document.createElement("p");
  views.className = "views-count";
  views.innerHTML = `<i class="fa-regular fa-eye"></i>${formatCount(
    post.views || 0
  )} views`;

  const likes = document.createElement("p");
  likes.className = "likes-count";
  likes.style.marginLeft = "10px";
  likes.innerHTML = `<i class="fa-regular fa-heart"></i>${formatCount(
    post.likes || 0
  )} likes`;

  actions.appendChild(views);
  actions.appendChild(likes);

  if (currentUserId && post.author_uid && post.author_uid === currentUserId) {
    const del = document.createElement("button");
    del.className = "delete-update";
    del.type = "button";
    del.textContent = "Delete Update";
    actions.appendChild(del);
  }

  card.appendChild(sourceCard);
  card.appendChild(description);
  card.appendChild(imageDiv);
  card.appendChild(actions);

  return card;
};

const incrementViews = async (post) => {
  if (!post || !post.post_id) return;
  const newViews = Number(post.views || 0) + 1;
  await supabase
    .from("Posts")
    .update({ views: newViews })
    .eq("post_id", post.post_id);
};

const incrementLikes = async (postId, currentLikes) => {
  const nextLikes = Number(currentLikes || 0) + 1;
  await supabase.from("Posts").update({ likes: nextLikes }).eq("post_id", postId);
  return nextLikes;
};

const loadPosts = async () => {
  const feeds = document.querySelector(".feeds-scroll");
  if (!feeds) return;

  const page = window.location.pathname.split("/").pop();
  const typeFilter = pageTypeMap[page];

  let query = supabase
    .from("Posts")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }
  const { data, error } = await query;
  if (error) return;

  feeds.innerHTML = "";
  (data || []).forEach((post) => {
    const card = renderCard(post);
    feeds.appendChild(card);
    incrementViews(post);
  });
};

const initNav = () => {
  if (typeof window.replace !== "function") {
    window.replace = window.location.replace.bind(window.location);
  }
  const body = document.body;
  const hamburger = document.querySelector(".hamburger");
  const overlay = document.querySelector(".sidebar-overlay");
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      body.classList.toggle("sidebar-open");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      body.classList.remove("sidebar-open");
    });
  }
  document.querySelectorAll(".nav-item[data-route]").forEach((item) => {
    item.addEventListener("click", () => {
      const route = item.getAttribute("data-route");
      if (route) {
        window.replace(route);
      }
    });
  });
  document.querySelectorAll(".upload--button").forEach((button) => {
    button.addEventListener("click", () => {
      window.replace("/upload-section/upload.html");
    });
  });
};

const initProfileModal = async () => {
  const profile = document.querySelector(".profile-infor");
  const profileModal = document.querySelector(".profile-modal");
  const exit = document.querySelector(".profile-modal .exit");
  if (profile && profileModal) {
    profile.addEventListener("click", () => {
      profileModal.classList.toggle("profile-modal--active");
      setBodyClass(
        "profile-open",
        profileModal.classList.contains("profile-modal--active")
      );
    });
  }
  if (exit && profileModal) {
    exit.addEventListener("click", () => {
      profileModal.classList.remove("profile-modal--active");
      setBodyClass("profile-open", false);
    });
  }

  const { session } = await getSession();
  if (!session) return;
  const user = session.user;
  currentUserId = user?.id || null;
  let profileData = await loadProfile();

  const nameInput = document.getElementById("profile-name");
  const emailInput = document.getElementById("profile-email");
  const imageInput = document.getElementById("image-upload");
  const updateBtn = document.querySelector(".update-profile:not(.exit)");

  if (imageInput) {
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;
      const avatarUrl = await uploadProfileImage(user, file);
      if (avatarUrl) {
        profileData = await updateProfile(profileData, { avatar_url: avatarUrl });
        setProfileImage(avatarUrl);
      }
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const updates = {};
      if (nameInput) updates.full_name = nameInput.value.trim();
      if (emailInput) updates.email = emailInput.value.trim();
      profileData = await updateProfile(profileData, updates);
      const updatedName = profileData?.full_name || "";
      setHiUser(updatedName);
      setSidebarProfile(updatedName);
    });
  }
};

const initStoryModal = () => {
  const storyModal = document.querySelector(".story-modal");
  const storyOverlay = storyModal?.querySelector(".story-modal__overlay");
  const storyClose = storyModal?.querySelector(".story-modal__close");
  const storyTitle = storyModal?.querySelector("#storyTitle");
  const storyAuthor = storyModal?.querySelector(".story-modal__author");
  const storyTime = storyModal?.querySelector(".story-modal__time");
  const storyTag = storyModal?.querySelector(".story-modal__tag");
  const storyBody = storyModal?.querySelector(".story-modal__body");
  const storyImageWrap = storyModal?.querySelector(".story-modal__image-wrap");
  const storyImage = storyModal?.querySelector(".story-modal__image");
  const storyAvatar = storyModal?.querySelector(".story-modal__avatar");

  const openStoryModal = (card) => {
    if (!storyModal || !card) return;
    const author = card.querySelector(".author-name")?.textContent?.trim() || "Community update";
    const time = card.querySelector(".timestamp")?.textContent?.trim() || "";
    const type = card.querySelector(".span-type")?.textContent?.trim() || "Update";
    const body = card.querySelector(".actual-description")?.textContent?.trim() || "";
    const img = card.querySelector(".feed-image");
    const authorImg = card.querySelector(".news-source-card--image");

    if (storyTitle) storyTitle.textContent = "Full story";
    if (storyAuthor) storyAuthor.textContent = author;
    if (storyTime) storyTime.textContent = time;
    if (storyTag) storyTag.textContent = type;
    if (storyBody) storyBody.textContent = body;
    if (storyAvatar && authorImg) {
      storyAvatar.src = authorImg.getAttribute("src") || PLACEHOLDER_PROFILE;
      storyAvatar.alt = authorImg.getAttribute("alt") || "";
    }

    if (storyImageWrap && storyImage) {
      if (img && img.getAttribute("src")) {
        storyImage.src = img.getAttribute("src");
        storyImage.alt = img.getAttribute("alt") || "Story image";
        storyImageWrap.classList.add("is-visible");
      } else {
        storyImageWrap.classList.remove("is-visible");
      }
    }

    storyModal.classList.add("story-modal--active");
    setBodyClass("story-open", true);
  };

  const closeStoryModal = () => {
    if (!storyModal) return;
    storyModal.classList.remove("story-modal--active");
    setBodyClass("story-open", false);
  };

  const feeds = document.querySelector(".feeds-scroll");
  if (feeds) {
    feeds.addEventListener("click", async (event) => {
      const readMore = event.target.closest(".read-more");
      if (readMore) {
        event.preventDefault();
        const card = readMore.closest(".news-card");
        openStoryModal(card);
        return;
      }
      const deleteBtn = event.target.closest(".delete-update");
      if (deleteBtn) {
        const card = deleteBtn.closest(".news-card");
        const postId = card?.dataset?.postId;
        if (!postId || !currentUserId) return;
        const confirmDelete = window.confirm("Delete this update?");
        if (!confirmDelete) return;
        const { error } = await supabase
          .from("Posts")
          .delete()
          .eq("post_id", postId)
          .eq("author_uid", currentUserId);
        if (error) {
          window.alert("Delete failed. Please try again.");
          return;
        }
        card.remove();
        return;
      }
      const likeBtn = event.target.closest(".likes-count");
      if (likeBtn) {
        const card = likeBtn.closest(".news-card");
        const postId = card?.dataset?.postId;
        if (!postId) return;
        const currentLikesText = likeBtn.textContent || "0";
        const currentLikes = Number(currentLikesText.replace(/[^\d]/g, "")) || 0;
        const nextLikes = await incrementLikes(postId, currentLikes);
        likeBtn.innerHTML = `<i class="fa-regular fa-heart"></i>${formatCount(nextLikes)} likes`;
      }
    });
  }

  if (storyOverlay) storyOverlay.addEventListener("click", closeStoryModal);
  if (storyClose) storyClose.addEventListener("click", closeStoryModal);
};

document.addEventListener("DOMContentLoaded", async () => {
  const { session } = await getSession();
  currentUserId = session?.user?.id || null;
  initNav();
  await initProfileModal();
  initStoryModal();
  await loadPosts();
});
