
      import { supabase, getSession } from "../supabase/index.js";

      const BUCKET = "campusconnect-media";
      const POST_IMAGE_PATH = "post-images";

      const drop = document.getElementById("drop");
      const fileInput = document.getElementById("fileInput");
      const clearBtn = document.getElementById("clearBtn");
      const queue = document.getElementById("queue");
      const emptyQueue = document.getElementById("emptyQueue");

      const typeEl = document.getElementById("type");
      const titleEl = document.getElementById("title");
      const bodyEl = document.getElementById("body");
      const visibilityEl = document.getElementById("visibility");
      const publishBtn = document.getElementById("publishBtn");
      const resetBtn = document.getElementById("resetBtn");
      const publishStatus = document.getElementById("publishStatus");

      const postsEl = document.getElementById("posts");
      const emptyPosts = document.getElementById("emptyPosts");


      
      let selectedFiles = [];
      let inFlight = false;
      let currentUser = null;
      let currentProfile = null;

      function humanBytes(bytes) {
        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unit = units[0];
        for (let i = 1; i < units.length && value >= 1024; i++) {
          value = value / 1024;
          unit = units[i];
        }
        return `${value.toFixed(value >= 10 || unit === "B" ? 0 : 1)} ${unit}`;
      }

      function setButtonsEnabled() {
        const hasFiles = selectedFiles.length > 0;
        clearBtn.disabled = !hasFiles || inFlight;
        publishBtn.disabled = inFlight;
        resetBtn.disabled = inFlight;
      }

      function renderQueue() {
        queue.innerHTML = "";
        emptyQueue.style.display = selectedFiles.length ? "none" : "block";
        setButtonsEnabled();

        selectedFiles.forEach((file) => {
          const card = document.createElement("div");
          card.className = "file";

          const top = document.createElement("div");
          top.className = "file-top";

          const name = document.createElement("div");
          name.className = "name";
          name.textContent = file.name;

          const meta = document.createElement("div");
          meta.className = "meta";
          meta.textContent = humanBytes(file.size);

          top.appendChild(name);
          top.appendChild(meta);

          const bar = document.createElement("div");
          bar.className = "bar";
          const fill = document.createElement("div");
          bar.appendChild(fill);

          const status = document.createElement("div");
          status.className = "status";
          status.textContent = "Ready";

          card.appendChild(top);
          card.appendChild(bar);
          card.appendChild(status);
          queue.appendChild(card);

          file._ui = { fill, status };
        });
      }

      function addFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        selectedFiles = [files[0]];
        renderQueue();
      }

      function clearQueue() {
        if (inFlight) return;
        selectedFiles = [];
        renderQueue();
      }

      function resetForm() {
        if (inFlight) return;
        typeEl.value = "story";
        titleEl.value = "";
        bodyEl.value = "";
        publishStatus.textContent = "";
        clearQueue();
      }

      function setDragState(on) {
        drop.classList.toggle("is-dragover", on);
      }

      drop.addEventListener("click", (e) => {
        if (e.target && (e.target.id === "clearBtn")) return;
        fileInput.click();
      });
      drop.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") fileInput.click();
      });
      fileInput.addEventListener("change", () => addFiles(fileInput.files));

      ["dragenter", "dragover"].forEach((ev) => {
        drop.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragState(true);
        });
      });
      ["dragleave", "drop"].forEach((ev) => {
        drop.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragState(false);
        });
      });
      drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

      clearBtn.addEventListener("click", clearQueue);
      resetBtn.addEventListener("click", resetForm);

      async function uploadSingleFile(file) {
        const filename = `${Date.now()}_${file.name}`;
        const path = `${POST_IMAGE_PATH}/${currentUser.id}/${filename}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: true });
        if (error) {
          throw new Error(error.message || "Upload failed");
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
      }

      async function refreshPosts() {
        try {
          const { data: posts, error } = await supabase
            .from("Posts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);
          if (error) return;
          postsEl.innerHTML = "";
          emptyPosts.style.display = posts.length ? "none" : "block";

          posts.forEach((p) => {
            const card = document.createElement("div");
            card.className = "post";

            const head = document.createElement("div");
            head.className = "post-head";

            const left = document.createElement("div");
            left.style.display = "flex";
            left.style.gap = "10px";
            left.style.alignItems = "baseline";
            left.style.flexWrap = "wrap";

            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = (p.type || "other").toUpperCase();

            const title = document.createElement("h3");
            title.className = "title";
            title.textContent = p.title || "(untitled)";

            left.appendChild(tag);
            left.appendChild(title);

            const when = document.createElement("div");
            when.className = "when";
            when.textContent = p.created_at ? new Date(p.created_at).toLocaleDateString() : "";

            head.appendChild(left);
            head.appendChild(when);

            const body = document.createElement("p");
            body.className = "body";
            body.textContent = p.body || "";

            card.appendChild(head);
            if ((p.body || "").trim()) card.appendChild(body);

            if (p.image_url) {
              const list = document.createElement("div");
              list.className = "attachments";
              const link = document.createElement("a");
              link.href = p.image_url;
              link.target = "_blank";
              link.rel = "noreferrer";
              link.textContent = "View attachment";
              list.appendChild(link);
              card.appendChild(list);
            }

            postsEl.appendChild(card);
          });
        } catch {
          // ignore
        }
      }

      async function publish() {
        const title = titleEl.value.trim();
        const body = bodyEl.value.trim();
        const type = typeEl.value;
        const visibility = visibilityEl?.value || "public";

        if (!title) {
          publishStatus.textContent = "Title is required.";
          return;
        }

        if (inFlight) return;
        inFlight = true;
        publishStatus.textContent = "Publishing…";
        setButtonsEnabled();

        try {
          let imageUrl = "";
          const file = selectedFiles[0];
          if (file) {
            file._ui.status.textContent = "Starting…";
            file._ui.fill.style.width = "0%";
            imageUrl = await uploadSingleFile(file);
            file._ui.fill.style.width = "100%";
            file._ui.status.className = "status ok";
            file._ui.status.textContent = "Uploaded";
          }

          const authorName =
            visibility === "public"
              ? currentProfile?.full_name ||
                currentUser.user_metadata?.full_name ||
                ""
              : "Anonymous";
          const authorPhoto =
            visibility === "public" ? currentProfile?.avatar_url || "" : "";

          const postPayload = {
            type,
            title,
            body,
            image_url: imageUrl || null,
            visibility,
            author_name: authorName,
            author_photo: authorPhoto,
            author_uid: currentUser.id,
            status: "pending",
          };

          const { error } = await supabase.from("Posts").insert(postPayload);
          if (error) {
            throw new Error(error.message || "Publish failed.");
          }

          publishStatus.textContent = "Published.";
          resetForm();
          await refreshPosts();
        } catch (err) {
          publishStatus.textContent = err && err.message ? err.message : "Publish failed.";
        } finally {
          inFlight = false;
          setButtonsEnabled();
        }
      }

      async function init() {
        const { session } = await getSession();
        if (!session) {
          window.location.href = "../signup-form.html";
          return;
        }
        currentUser = session.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, avatar_url")
          .eq("user_id", currentUser.id)
          .single();
        currentProfile = profile || null;
        publishBtn.addEventListener("click", publish);
        renderQueue();
        refreshPosts();
      }

      init();
