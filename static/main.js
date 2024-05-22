function scrollTerminalToBottom() {
    var terminal_stdout = document.getElementById("terminal_stdout");
    terminal_stdout.scrollTop = terminal_stdout.scrollHeight;
}

async function getInitialLogDisplay(limit = 10) {
    //Inital fetch of log data
    const response = await fetch(`/log`);
    if (!response.ok) {
        console.error(response);
        alert("Failed to fetch log data");
        return;
    }
    const data = await response.json();

    if (data.numlines > 0) {
        document.getElementById("terminal_stdout").innerHTML = data.log + "<br>";
        scrollTerminalToBottom();
    }
}
getInitialLogDisplay();

function appendToLog(s) {
    console.log("appendToLog", s);
    document.getElementById("terminal_stdout").innerHTML += s + "<br>";
    scrollTerminalToBottom();
}

function cmdClickable() {
    // checkboxes
    document.querySelectorAll(".beets-selection").forEach(function (checkbox) {
        checkbox.addEventListener("click", function (e) {
            if (e.metaKey) {
                checkAdjacentBoxes(this);
            }
        });
    });

    // expands
    var toggles = document.querySelectorAll(".collapse-toggle");
    toggles.forEach(function (t) {
        t.addEventListener("click", function (event) {
            if (event.metaKey) {
                let newState = t.getAttribute("aria-expanded");
                toggles.forEach(function (other) {
                    if (
                        other !== t &&
                        other.getAttribute("aria-expanded") !== newState
                    ) {
                        other.click();
                    }
                });
            }
        });
    });
}

function checkAdjacentBoxes(element) {
    var checked;
    if (element.type === "checkbox") {
        checked = !element.checked;
    } else {
        checked = element.getAttribute("data-checked") === "true";
        element.setAttribute("data-checked", !checked);
    }

    var parent = element.closest(".tag-group");
    parent.querySelectorAll(".beets-selection").forEach(function (c) {
        c.checked = !checked;
    });
}

function beetSelected(element, task) {
    let num_selected = 0;
    var parent = element.closest(".tag-group");
    parent.querySelectorAll(".beets-selection").forEach(function (c) {
        if (c.checked && c.hasAttribute("data-beets-id")) {
            num_selected++;
            let beetsId = c.getAttribute("data-beets-id");

            if (task.toLowerCase() === "clear") {
                post("/clear_beets", { ids: [beetsId] });
            } else {
                post("/task_for_id", { ids: [beetsId], task: task });
            }
        }
    });
    console.log(`Beet ${task} ${num_selected} selected items`);
}

function toggleGlobalDetailsPreference(e) {
    show_new = e.checked;
    localStorage.setItem("show_new", show_new);
    // also fold/unfold all
    var toggles = document
        .getElementById("tags_container")
        .querySelectorAll(".collapse-toggle");
    for (let t of toggles) {
        let isExpanded = t.getAttribute("aria-expanded") === "true";
        if (isExpanded != show_new) t.click();
    }
}

// Listen to collapse events so we persist across data refreshs
var collapseState = JSON.parse(localStorage.getItem("collapseState")) || {};

document.addEventListener("show.bs.collapse", function (e) {
    let id =
        Array.from(e.target.classList).find((cls) => cls.startsWith("collapse-")) ||
        e.target.id;
    console.log("show.bs.collapse", id);
    collapseState[id] = true;
    localStorage.setItem("collapseState", JSON.stringify(collapseState));
});
document.addEventListener("hide.bs.collapse", function (e) {
    let id =
        Array.from(e.target.classList).find((cls) => cls.startsWith("collapse-")) ||
        e.target.id;
    console.log("hide.bs.collapse", id);
    collapseState[id] = false;
    localStorage.setItem("collapseState", JSON.stringify(collapseState));
});

async function updateTagDisplay() {
    const container = document.getElementById("tags_container");
    const response = await fetch("/tags_data");
    const data = await response.text();
    container.innerHTML = data;
    console.log("Tags updated");

    restoreCollapseState();
    cmdClickable();
    enableTooltips();
}
updateTagDisplay();

async function updateInboxDisplay() {
    const container = document.getElementById("inbox_container");
    const response = await fetch("/inbox_data");
    const data = await response.text();
    container.innerHTML = data;
    console.log("Inbox updated");

    restoreCollapseState();
    cmdClickable();
    enableTooltips();
}
updateInboxDisplay();

function restoreCollapseState() {
    show_new = localStorage.getItem("show_new") === "true";
    document.getElementById("global-details-toggle").checked = show_new;
    var toggles = document.querySelectorAll(".collapse-toggle");
    for (let t of toggles) {
        var id = t.getAttribute("data-bs-target").substring(1);
        var show_this = show_new;
        if (id in collapseState) show_this = collapseState[id];

        let byId = document.getElementById(id);
        let byClass = Array.from(document.getElementsByClassName(id));
        let elements = byId ? [byId, ...byClass] : byClass;
        for (let el of elements) {
            if (show_this) {
                el.classList.add("show");
                t.setAttribute("aria-expanded", "true");
            } else {
                el.classList.remove("show");
                t.setAttribute("aria-expanded", "false");
            }
        }
        collapseState[id] = show_this;
        localStorage.setItem("collapseState", JSON.stringify(collapseState));
    }
}

function enableTooltips() {

    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(
        (tooltipTriggerEl) =>
            new bootstrap.Tooltip(tooltipTriggerEl, {
                container: "body",
                // trigger: "click",
                boundary: document.body,
                placement: "right",
                fallbackPlacements: [],
                sanitize: false,
                html: true,
                // coult not figure out how to tell bs and popper to just center the damn thing on the page. 200 seems okayish in my case
                offset: [0, 10],
                template:
                    '<div class="tooltip beets-tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner beets-tooltip-inner"></div></div>',
            })
    );
}

var source = new EventSource("/stream");

source.addEventListener(
    "tags",
    async function (event) {
        await updateTagDisplay();
        await updateInboxDisplay();
    },
    false
);

source.addEventListener(
    "inbox",
    async function (event) {
        await updateInboxDisplay();
    },
    false
);

source.addEventListener(
    "logs",
    async function (event) {
        data = JSON.parse(event.data);
        appendToLog(data.message);
    },
    false
);

function get(endpoint, args) {
    fetch(endpoint + "?" + new URLSearchParams(args).toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => console.log(data))
        .catch((error) => console.error("Error:", error));
}

function post(endpoint, args) {
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => console.log(data))
        .catch((error) => console.error("Error:", error));
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        var dropdowns = document.querySelectorAll(".dropdown-menu.show");
        dropdowns.forEach(function (dropdown) {
            dropdown.classList.remove("show");
        });
    }
});
