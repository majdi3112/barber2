const hours = {
  0: [10, 21],
  1: [10, 20],
  2: null,
  3: [10, 20],
  4: [10, 20],
  5: [10, 21],
  6: [10, 21],
};

const dayNames = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

const services = {
  fade: { name: "Precision Fade", mins: 45 },
  cut: { name: "Signature Cut", mins: 45 },
  beard: { name: "Beard & Contour", mins: 30 },
  lineup: { name: "Line-up", mins: 20 },
  full: { name: "Full Look", mins: 60 },
  kids: { name: "Kids Cut", mins: 30 },
};

const STORAGE_KEY = "barber-sbx-appointments";
let lastBooking = null;

function brusselsNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return {
    day: weekdayIndex,
    minutes: Number(map.hour) * 60 + Number(map.minute),
    isoDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date()),
  };
}

function nextOpen(day) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = (day + offset) % 7;
    if (hours[next]) {
      return `${dayNames[next]} om ${hours[next][0]}u`;
    }
  }
  return "binnenkort";
}

function refreshStatus() {
  const { day, minutes } = brusselsNow();
  const range = hours[day];
  const pill = document.getElementById("statusPill");
  const live = document.getElementById("liveLine");
  const rows = document.querySelectorAll("#hoursTable li");

  rows.forEach((row) => {
    row.classList.toggle("today", Number(row.dataset.day) === day);
  });

  const open = Boolean(range) && minutes >= range[0] * 60 && minutes < range[1] * 60;

  if (open) {
    pill.textContent = `Open tot ${range[1]}u`;
    pill.className = "status-pill open";
    live.textContent = `Nu open — tot ${range[1]}u`;
  } else if (range && minutes < range[0] * 60) {
    pill.textContent = `Opent om ${range[0]}u`;
    pill.className = "status-pill closed";
    live.textContent = `Vandaag open vanaf ${range[0]}u`;
  } else {
    pill.textContent = "Gesloten";
    pill.className = "status-pill closed";
    live.textContent = `Nu gesloten · terug ${nextOpen(day)}`;
  }
}

function setupNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 20);
  });
}

function setupLightbox() {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  const close = document.getElementById("lightboxClose");

  document.querySelectorAll("[data-lightbox]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      img.src = link.getAttribute("href");
      img.alt = link.querySelector("img")?.alt || "";
      box.hidden = false;
    });
  });

  const hide = () => {
    box.hidden = true;
    img.src = "";
  };

  close.addEventListener("click", hide);
  box.addEventListener("click", (event) => {
    if (event.target === box) hide();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
}

function setupCursor() {
  const cursor = document.querySelector(".cursor");
  if (!cursor || window.matchMedia("(hover: none)").matches) return;

  window.addEventListener("pointermove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  document.querySelectorAll("a, button, .service-chip, .slot").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("grow"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("grow"));
  });
}

function setupReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
  );

  nodes.forEach((node) => io.observe(node));
}

function setupCountUp() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const start = performance.now();
        const tick = (now) => {
          const progress = Math.min((now - start) / 1100, 1);
          const eased = 1 - (1 - progress) ** 3;
          el.textContent = `${Math.round(target * eased)}${suffix}`;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => io.observe(el));
}

function loadBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBookings(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function minutesToLabel(total) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function weekdayFromIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function selectedServiceId() {
  return document.querySelector('input[name="service"]:checked')?.value || "fade";
}

function renderSlots() {
  const dateInput = document.getElementById("bookDate");
  const slotsBox = document.getElementById("slots");
  const hint = document.getElementById("slotHint");
  const timeInput = document.getElementById("bookTime");
  const date = dateInput.value;
  timeInput.value = "";
  slotsBox.innerHTML = "";

  if (!date) {
    hint.textContent = "Kies eerst een datum.";
    return;
  }

  const day = weekdayFromIso(date);
  const range = hours[day];
  if (!range) {
    hint.textContent = "Dinsdag zijn we gesloten. Kies een andere dag.";
    return;
  }

  const duration = services[selectedServiceId()].mins;
  const taken = new Set(
    loadBookings()
      .filter((item) => item.date === date)
      .map((item) => item.time)
  );
  const now = brusselsNow();
  const slots = [];

  for (let start = range[0] * 60; start + duration <= range[1] * 60; start += 30) {
    const label = minutesToLabel(start);
    const tooSoon = date === now.isoDate && start <= now.minutes + 30;
    slots.push({ label, taken: taken.has(label) || tooSoon });
  }

  if (!slots.length) {
    hint.textContent = "Geen uren meer op deze dag.";
    return;
  }

  hint.textContent = `Beschikbaar op ${dayNames[day]} · ${duration} min`;

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot";
    button.textContent = slot.label;
    button.disabled = slot.taken;
    button.addEventListener("click", () => {
      document.querySelectorAll(".slot").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      timeInput.value = slot.label;
    });
    slotsBox.appendChild(button);
  });
}

function setupBooking() {
  const form = document.getElementById("bookForm");
  const dateInput = document.getElementById("bookDate");
  const success = document.getElementById("bookSuccess");
  const now = brusselsNow();

  dateInput.min = now.isoDate;
  const max = new Date();
  max.setDate(max.getDate() + 45);
  dateInput.max = max.toISOString().slice(0, 10);

  dateInput.addEventListener("change", renderSlots);
  document.querySelectorAll('input[name="service"]').forEach((input) => {
    input.addEventListener("change", renderSlots);
  });

  document.querySelectorAll("[data-book]").forEach((link) => {
    link.addEventListener("click", () => {
      const value = link.dataset.book;
      const radio = document.querySelector(`input[name="service"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
        renderSlots();
      }
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const serviceId = selectedServiceId();
    const booking = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: document.getElementById("bookName").value.trim(),
      phone: document.getElementById("bookPhone").value.trim(),
      email: document.getElementById("bookEmail").value.trim(),
      date: dateInput.value,
      time: document.getElementById("bookTime").value,
      note: document.getElementById("bookNote").value.trim(),
      service: services[serviceId].name,
      mins: services[serviceId].mins,
    };

    if (!booking.time) {
      document.getElementById("slotHint").textContent = "Kies een tijdstip.";
      return;
    }

    const list = loadBookings();
    list.push(booking);
    saveBookings(list);
    lastBooking = booking;

    form.hidden = true;
    success.hidden = false;
    document.getElementById("bookSummary").textContent =
      `${booking.name}, ${booking.service.toLowerCase()} op ${formatLongDate(booking.date)} om ${booking.time} bij Barber SBX, Grote Kaai 9, Lokeren. Tot dan.`;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.getElementById("bookNew").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.reset();
    document.querySelector('input[name="service"][value="fade"]').checked = true;
    document.getElementById("bookTime").value = "";
    renderSlots();
  });

  document.getElementById("bookIcs").addEventListener("click", () => {
    if (!lastBooking) return;
    downloadIcs(lastBooking);
  });

  renderSlots();
}

function formatLongDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function downloadIcs(booking) {
  const [year, month, day] = booking.date.split("-").map(Number);
  const [hour, minute] = booking.time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + booking.mins * 60000);
  const stamp = (date) =>
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barber SBX//NL",
    "BEGIN:VEVENT",
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:Barber SBX — ${booking.service}`,
    "LOCATION:Grote Kaai 9\\, 9160 Lokeren",
    `DESCRIPTION:Afspraak voor ${booking.name}. ${booking.note || "Have some confidence."}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "barber-sbx-afspraak.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function setupVideos() {
  const playAll = () => {
    document.querySelectorAll("video").forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.controls = false;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      const start = video.play();
      if (start && typeof start.catch === "function") start.catch(() => {});
    });
  };

  playAll();
  document.addEventListener("DOMContentLoaded", playAll);
  window.addEventListener("load", playAll);
  document.addEventListener("touchstart", playAll, { once: true, passive: true });
  document.addEventListener("click", playAll, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") playAll();
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const video = entry.target;
          video.muted = true;
          const start = video.play();
          if (start && typeof start.catch === "function") start.catch(() => {});
        });
      },
      { threshold: 0.2 }
    );
    document.querySelectorAll("video").forEach((video) => io.observe(video));
  }
}

window.addEventListener("load", () => {
  document.getElementById("loader").classList.add("hide");
});

document.getElementById("year").textContent = new Date().getFullYear();
setupNav();
setupLightbox();
setupCursor();
setupReveal();
setupCountUp();
setupBooking();
setupVideos();
refreshStatus();
setInterval(refreshStatus, 60000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshStatus();
});
