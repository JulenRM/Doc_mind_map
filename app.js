const appState = {
    file: null,
    fileContent: null,
    results: {
        json: null,
        mermaid: "",
    },
    originals: {
        json: null,
        mermaid: "",
        tree: null,
    },
    mermaidRendered: false,
    resultView: "json",
    diagramMode: "visual",
    tree: null,
    selectedNodeId: null,
    connectFromId: null,
    deleteConnectionMode: false,
};

const modelNames = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-latest",
    google: "gemini-1.5-pro",
    custom: "",
};

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const processBtn = document.getElementById("processBtn");
const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const mermaidOutput = document.getElementById("mermaidOutput");
const jsonOutput = document.getElementById("jsonOutput");
const mermaidPreview = document.getElementById("mermaidPreview");
const visualEditor = document.getElementById("visualEditor");
const visualMap = document.getElementById("visualMap");

if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
}

document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
});

uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
    }
});
uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadArea.classList.add("dragging");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragging"));
uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("dragging");
    handleFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
providerSelect.addEventListener("change", updateProviderFields);
processBtn.addEventListener("click", processDocument);
document.getElementById("testConnectionBtn").addEventListener("click", testLLMConnection);
document.getElementById("toggleConfigBtn").addEventListener("click", toggleConfigPanel);
document.getElementById("toggleApiKeyBtn").addEventListener("click", toggleApiKeyVisibility);
document.getElementById("resultView").addEventListener("change", updateResultView);
document.getElementById("toggleMermaidViewBtn").addEventListener("click", showRenderedMermaid);
document.getElementById("visualEditorBtn").addEventListener("click", showVisualEditor);
document.getElementById("editJsonBtn").addEventListener("click", toggleJsonEdit);
document.getElementById("restoreJsonBtn").addEventListener("click", restoreOriginalJson);
document.getElementById("editMermaidBtn").addEventListener("click", toggleMermaidEdit);
document.getElementById("restoreMermaidBtn").addEventListener("click", restoreOriginalMermaid);
document.getElementById("downloadJsonBtn").addEventListener("click", downloadJson);
document.getElementById("downloadMermaidBtn").addEventListener("click", downloadMermaid);
document.getElementById("downloadPngBtn").addEventListener("click", downloadPng);
document.getElementById("renameNodeBtn").addEventListener("click", renameSelectedNode);
document.getElementById("addChildBtn").addEventListener("click", addChildNode);
document.getElementById("addSiblingBtn").addEventListener("click", addSiblingNode);
document.getElementById("deleteNodeBtn").addEventListener("click", deleteSelectedNode);
document.getElementById("connectNodeBtn").addEventListener("click", startConnectingNodes);
document.getElementById("deleteConnectionBtn").addEventListener("click", toggleDeleteConnectionMode);
mermaidOutput.addEventListener("input", () => {
    appState.results.mermaid = mermaidOutput.value;
    appState.mermaidRendered = false;
    appState.tree = parseMermaidMindmap(mermaidOutput.value) || appState.tree;
    renderVisualEditor();
});
jsonOutput.addEventListener("input", () => {
    try {
        appState.results.json = JSON.parse(jsonOutput.value);
    } catch {
        // The user may be in the middle of typing incomplete JSON.
    }
});

updateProviderFields();
updateResultView();

function switchTab(tabName) {
    document.querySelectorAll(".content").forEach((content) => content.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.remove("active"));

    document.getElementById(tabName).classList.add("active");
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
}

async function handleFiles(files) {
    if (files.length === 0) {
        return;
    }

    const file = files[0];
    const validTypes = [".pdf", ".docx", ".txt", ".md"];
    const extension = `.${file.name.split(".").pop().toLowerCase()}`;

    if (!validTypes.includes(extension)) {
        showAlert("uploadAlert", "Invalid file type. Supported: PDF, DOCX, TXT, MD", "error");
        return;
    }

    appState.file = file;
    updateFileList();
    processBtn.disabled = false;
    showAlert("uploadAlert", `File ready: ${file.name}`, "success");

    try {
        await extractFileContent(file);
    } catch (error) {
        showAlert("uploadAlert", `Error reading file: ${error.message}`, "error");
    }
}

function updateFileList() {
    const list = document.getElementById("fileList");
    list.innerHTML = "";

    if (!appState.file) {
        return;
    }

    const item = document.createElement("li");
    const fileName = document.createElement("span");
    const removeButton = document.createElement("button");

    fileName.textContent = appState.file.name;
    removeButton.className = "btn btn-secondary";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", clearFile);

    item.append(fileName, removeButton);
    list.appendChild(item);
}

function clearFile() {
    appState.file = null;
    appState.fileContent = null;
    fileInput.value = "";
    processBtn.disabled = true;
    updateFileList();
    showAlert("uploadAlert", "File cleared", "info");
}

async function extractFileContent(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "txt" || extension === "md") {
        appState.fileContent = await file.text();
        return;
    }

    appState.fileContent = `${file.name} was uploaded, but this static page can only extract text directly from TXT and MD files right now. Convert the document to plain text for best results.`;
}

function updateProviderFields() {
    const provider = providerSelect.value;
    const customGroup = document.getElementById("customEndpointGroup");
    const modelNameInput = document.getElementById("modelName");

    customGroup.style.display = provider === "custom" ? "block" : "none";
    modelNameInput.placeholder = modelNames[provider] || "Model name";
    if (!modelNameInput.value) {
        modelNameInput.value = modelNames[provider] || "";
    }
}

function toggleApiKeyVisibility() {
    const button = document.getElementById("toggleApiKeyBtn");
    const isHidden = apiKeyInput.type === "password";

    apiKeyInput.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Hide" : "Show";
    button.setAttribute("aria-label", isHidden ? "Hide API key" : "Show API key");
}

function toggleConfigPanel() {
    const configPanel = document.getElementById("config");
    const button = document.getElementById("toggleConfigBtn");
    const isHidden = configPanel.classList.toggle("hidden");

    button.textContent = isHidden ? "Show Config" : "Hide Config";
}

function toggleJsonEdit() {
    const button = document.getElementById("editJsonBtn");
    const isReadonly = jsonOutput.hasAttribute("readonly");

    if (isReadonly) {
        jsonOutput.removeAttribute("readonly");
        jsonOutput.focus();
        button.textContent = "Done";
        showAlert("resultsAlert", "Editing JSON. Press Done to validate and keep the changes.", "info");
        return;
    }

    try {
        appState.results.json = JSON.parse(jsonOutput.value);
        jsonOutput.value = JSON.stringify(appState.results.json, null, 2);
        jsonOutput.setAttribute("readonly", "");
        button.textContent = "Edit";
        showAlert("resultsAlert", "JSON changes saved.", "success");
    } catch (error) {
        showAlert("resultsAlert", `Invalid JSON: ${error.message}`, "error");
    }
}

function restoreOriginalJson() {
    if (!appState.originals.json) {
        showAlert("resultsAlert", "There is no original JSON to restore yet.", "error");
        return;
    }

    appState.results.json = cloneData(appState.originals.json);
    jsonOutput.value = JSON.stringify(appState.results.json, null, 2);
    jsonOutput.setAttribute("readonly", "");
    document.getElementById("editJsonBtn").textContent = "Edit";
    showAlert("resultsAlert", "Original JSON restored.", "success");
}

async function testLLMConnection() {
    const requestConfig = getRequestConfig();

    if (!requestConfig) {
        return;
    }

    setConnectionStatus("Testing...", "");
    showAlert("configAlert", "Testing connection with the selected provider...", "info");

    try {
        const response = await callLLM(requestConfig, "Reply with only the word connected.");
        if (!response.toLowerCase().includes("connected")) {
            throw new Error("Provider responded, but not with the expected test response.");
        }

        setConnectionStatus("Connected", "connected");
        showAlert("configAlert", "Connection successful.", "success");
    } catch (error) {
        setConnectionStatus("Connection failed", "error");
        showAlert("configAlert", `Connection failed: ${error.message}`, "error");
    }
}

async function processDocument() {
    const requestConfig = getRequestConfig();

    if (!requestConfig) {
        return;
    }

    if (!appState.fileContent) {
        showAlert("uploadAlert", "Please upload a document first.", "error");
        return;
    }

    switchTab("results");
    showStatus("Extracting JSON structure...");
    clearResults();

    try {
        const jsonText = await callLLM(requestConfig, buildJsonPrompt(appState.fileContent));
        const jsonResult = parseJsonResponse(jsonText);

        appState.results.json = jsonResult;
        jsonOutput.value = JSON.stringify(jsonResult, null, 2);
        showStatus("Generating Mermaid mind map...");

        const mermaidText = await callLLM(requestConfig, buildMermaidPrompt(jsonResult));
        appState.results.mermaid = cleanMermaidResponse(mermaidText);
        appState.tree = parseMermaidMindmap(appState.results.mermaid) || jsonToTree(jsonResult);
        appState.results.mermaid = treeToMermaid(appState.tree);
        mermaidOutput.value = appState.results.mermaid;
        appState.selectedNodeId = appState.tree.id;
        appState.originals.json = cloneData(appState.results.json);
        appState.originals.mermaid = appState.results.mermaid;
        appState.originals.tree = cloneData(appState.tree);

        document.getElementById("resultsGrid").style.display = "grid";
        showVisualEditor();
        updateResultView();
        hideStatus();
        showAlert("resultsAlert", "Document processed successfully.", "success");
    } catch (error) {
        hideStatus();
        showAlert("resultsAlert", `Processing failed: ${error.message}`, "error");
    }
}

function getRequestConfig() {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const modelName = document.getElementById("modelName").value.trim() || modelNames[provider];
    const temperature = Number.parseFloat(document.getElementById("temperature").value);
    const apiEndpoint = document.getElementById("apiEndpoint").value.trim();

    if (!apiKey && provider !== "custom") {
        showAlert("configAlert", "Please enter an API key.", "error");
        return null;
    }

    if (provider === "custom" && !apiEndpoint) {
        showAlert("configAlert", "Please enter a custom API endpoint.", "error");
        return null;
    }

    return {
        provider,
        apiKey,
        modelName,
        temperature: Number.isFinite(temperature) ? temperature : 0.2,
        apiEndpoint,
    };
}

async function callLLM(config, prompt) {
    if (config.provider === "openai") {
        return callOpenAI(config, prompt);
    }

    if (config.provider === "anthropic") {
        return callAnthropic(config, prompt);
    }

    if (config.provider === "google") {
        return callGoogle(config, prompt);
    }

    return callCustomEndpoint(config, prompt);
}

async function callOpenAI(config, prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.modelName,
            temperature: config.temperature,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    const data = await readJsonResponse(response);
    return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(config, prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: config.modelName,
            max_tokens: 2500,
            temperature: config.temperature,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    const data = await readJsonResponse(response);
    return data.content?.map((part) => part.text || "").join("") || "";
}

async function callGoogle(config, prompt) {
    const model = encodeURIComponent(config.modelName);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: config.temperature },
        }),
    });
    const data = await readJsonResponse(response);
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function callCustomEndpoint(config, prompt) {
    const headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(config.apiEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: config.modelName,
            temperature: config.temperature,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    const data = await readJsonResponse(response);
    return data.choices?.[0]?.message?.content || data.output_text || data.text || JSON.stringify(data);
}

async function readJsonResponse(response) {
    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }

    if (!response.ok) {
        const message = data.error?.message || data.message || text || `${response.status} ${response.statusText}`;
        throw new Error(message);
    }

    return data;
}

function buildJsonPrompt(content) {
    return `Analyze this document and extract its hierarchy as strict JSON.

Return only JSON. Do not use markdown fences.
Schema:
{
  "title": "Document title",
  "sections": [
    {
      "title": "Section title",
      "level": 1,
      "summary": "One short sentence",
      "children": []
    }
  ]
}

Document:
${content.substring(0, 12000)}`;
}

function buildMermaidPrompt(jsonResult) {
    return `Create a Mermaid mindmap from this document hierarchy.

Return only valid Mermaid code. Do not use markdown fences.
Use this format:
mindmap
  root((Title))
    Section
      Subsection

Hierarchy JSON:
${JSON.stringify(jsonResult, null, 2)}`;
}

function parseJsonResponse(text) {
    const cleaned = stripCodeFence(text).trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const candidate = firstBrace >= 0 && lastBrace >= 0 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

    try {
        return JSON.parse(candidate);
    } catch (error) {
        throw new Error(`The provider did not return valid JSON. ${error.message}`);
    }
}

function cleanMermaidResponse(text) {
    const cleaned = stripCodeFence(text).trim();
    return cleaned.startsWith("mindmap") || cleaned.startsWith("graph") || cleaned.startsWith("flowchart")
        ? cleaned
        : `mindmap\n  root((${escapeMermaidText(appState.results.json?.title || "Document")}))`;
}

function stripCodeFence(text) {
    return text.replace(/^```(?:json|mermaid)?\s*/i, "").replace(/```$/i, "");
}

async function renderMermaid() {
    if (!window.mermaid) {
        showAlert("resultsAlert", "Mermaid could not be loaded. Check your internet connection and try again.", "error");
        return;
    }

    try {
        const id = `mindmap-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidOutput.value);
        mermaidPreview.innerHTML = svg;
        appState.mermaidRendered = true;
        appState.diagramMode = "rendered";
    } catch (error) {
        showAlert("resultsAlert", `Mermaid render failed: ${error.message}`, "error");
    }
}

async function showRenderedMermaid() {
    await renderMermaid();
    mermaidPreview.style.display = "block";
    visualEditor.style.display = "none";
    document.getElementById("toggleMermaidViewBtn").disabled = true;
    document.getElementById("visualEditorBtn").disabled = false;
}

function showVisualEditor() {
    appState.diagramMode = "visual";
    mermaidPreview.style.display = "none";
    visualEditor.style.display = "block";
    document.getElementById("toggleMermaidViewBtn").disabled = false;
    document.getElementById("visualEditorBtn").disabled = true;
    renderVisualEditor();
}

function toggleMermaidEdit() {
    const button = document.getElementById("editMermaidBtn");
    const isReadonly = mermaidOutput.hasAttribute("readonly");

    if (isReadonly) {
        mermaidOutput.removeAttribute("readonly");
        mermaidOutput.focus();
        button.textContent = "Done";
        showAlert("resultsAlert", "Editing Mermaid code. Render again to preview your changes.", "info");
    } else {
        mermaidOutput.setAttribute("readonly", "");
        appState.results.mermaid = mermaidOutput.value;
        appState.tree = parseMermaidMindmap(mermaidOutput.value) || appState.tree;
        renderVisualEditor();
        button.textContent = "Edit";
    }
}

function restoreOriginalMermaid() {
    if (!appState.originals.mermaid || !appState.originals.tree) {
        showAlert("resultsAlert", "There is no original Mermaid diagram to restore yet.", "error");
        return;
    }

    appState.results.mermaid = appState.originals.mermaid;
    appState.tree = cloneData(appState.originals.tree);
    appState.selectedNodeId = appState.tree.id;
    appState.connectFromId = null;
    appState.deleteConnectionMode = false;
    mermaidOutput.value = appState.results.mermaid;
    mermaidOutput.setAttribute("readonly", "");
    document.getElementById("editMermaidBtn").textContent = "Edit";
    document.getElementById("deleteConnectionBtn").textContent = "Delete Connection";
    appState.mermaidRendered = false;
    showVisualEditor();
    showAlert("resultsAlert", "Original Mermaid diagram restored.", "success");
}

function clearResults() {
    appState.results.json = null;
    appState.results.mermaid = "";
    appState.originals.json = null;
    appState.originals.mermaid = "";
    appState.originals.tree = null;
    appState.mermaidRendered = false;
    appState.tree = null;
    appState.selectedNodeId = null;
    appState.connectFromId = null;
    appState.deleteConnectionMode = false;
    jsonOutput.value = "";
    mermaidOutput.value = "";
    jsonOutput.setAttribute("readonly", "");
    mermaidOutput.setAttribute("readonly", "");
    document.getElementById("editJsonBtn").textContent = "Edit";
    document.getElementById("editMermaidBtn").textContent = "Edit";
    document.getElementById("deleteConnectionBtn").textContent = "Delete Connection";
    mermaidPreview.innerHTML = "";
    visualMap.innerHTML = "";
    showVisualEditor();
    document.getElementById("resultsGrid").style.display = "none";
}

function showStatus(message) {
    document.getElementById("status").style.display = "block";
    document.getElementById("statusText").textContent = message;
}

function hideStatus() {
    document.getElementById("status").style.display = "none";
}

function showAlert(elementId, message, type) {
    const alertRoot = document.getElementById(elementId);
    alertRoot.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function setConnectionStatus(message, className) {
    const status = document.getElementById("connectionStatus");
    status.textContent = message;
    status.className = `connection-status ${className}`.trim();
}

function downloadJson() {
    const data = appState.results.json ? JSON.stringify(appState.results.json, null, 2) : jsonOutput.value;
    downloadFile(data, "document-tree.json", "application/json");
}

function downloadMermaid() {
    downloadFile(mermaidOutput.value, "document-mind-map.mmd", "text/plain");
}

async function downloadPng() {
    let svg = null;

    if (appState.diagramMode === "visual") {
        svg = visualMap;
    } else {
        if (!appState.mermaidRendered) {
            await renderMermaid();
        }
        svg = mermaidPreview.querySelector("svg");
    }

    if (!svg) {
        showAlert("resultsAlert", "There is no diagram available to download yet.", "error");
        return;
    }

    const clonedSvg = svg.cloneNode(true);
    const box = getSvgBox(svg);

    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clonedSvg.setAttribute("width", String(box.width));
    clonedSvg.setAttribute("height", String(box.height));
    clonedSvg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    embedSvgExportStyles(clonedSvg);

    const svgText = new XMLSerializer().serializeToString(clonedSvg);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    const image = new Image();

    image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = Math.max(box.width, 1) * scale;
        canvas.height = Math.max(box.height, 1) * scale;

        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                downloadBlob(blob, "document-mind-map.png");
            }
        }, "image/png");
    };
    image.onerror = () => {
        showAlert("resultsAlert", "Could not export the rendered mind map as PNG.", "error");
    };
    image.src = url;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function escapeMermaidText(text) {
    return String(text).replace(/[()]/g, "");
}

function updateResultView() {
    const select = document.getElementById("resultView");
    const grid = document.getElementById("resultsGrid");
    appState.resultView = select.value;
    grid.classList.toggle("json-mode", appState.resultView === "json");
    grid.classList.toggle("mermaid-mode", appState.resultView === "mermaid");
}

function jsonToTree(jsonResult) {
    const root = {
        id: createNodeId(),
        title: jsonResult?.title || "Document",
        children: [],
    };
    root.children = normalizeJsonSections(jsonResult?.sections || []);
    return root;
}

function normalizeJsonSections(sections) {
    return sections.map((section) => ({
        id: createNodeId(),
        title: section.title || "Untitled",
        children: normalizeJsonSections(section.children || []),
    }));
}

function parseMermaidMindmap(code) {
    const lines = code.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("%%"));
    const mindmapIndex = lines.findIndex((line) => line.trim().toLowerCase() === "mindmap");
    if (mindmapIndex === -1) {
        return null;
    }

    const stack = [];
    let root = null;

    for (const line of lines.slice(mindmapIndex + 1)) {
        const indent = line.match(/^\s*/)[0].length;
        const level = Math.floor(indent / 2);
        const node = {
            id: createNodeId(),
            title: cleanMermaidNodeTitle(line.trim()),
            children: [],
        };

        if (!root) {
            root = node;
            stack[level] = node;
            continue;
        }

        while (stack.length > level) {
            stack.pop();
        }

        const parent = stack[level - 1] || root;
        parent.children.push(node);
        stack[level] = node;
    }

    return root;
}

function cleanMermaidNodeTitle(title) {
    return title
        .replace(/^root\s*/i, "")
        .replace(/^\(\(/, "")
        .replace(/\)\)$/, "")
        .replace(/^\(/, "")
        .replace(/\)$/, "")
        .trim() || "Untitled";
}

function treeToMermaid(tree) {
    if (!tree) {
        return "";
    }

    const lines = ["mindmap", `  root((${formatMermaidNodeTitle(tree.title)}))`];
    tree.children.forEach((child) => appendMermaidNode(lines, child, 2));
    return lines.join("\n");
}

function appendMermaidNode(lines, node, level) {
    lines.push(`${"  ".repeat(level)}${formatMermaidNodeTitle(node.title)}`);
    node.children.forEach((child) => appendMermaidNode(lines, child, level + 1));
}

function formatMermaidNodeTitle(title) {
    return escapeMermaidText(title).replace(/\s+/g, " ").trim() || "Untitled";
}

function renderVisualEditor() {
    visualMap.innerHTML = "";

    if (!appState.tree) {
        return;
    }

    const layout = [];
    const links = [];
    let leafIndex = 0;
    layoutTree(appState.tree, 0);

    const maxX = Math.max(...layout.map((item) => item.x), 0) + 220;
    const maxY = Math.max(...layout.map((item) => item.y), 0) + 90;
    visualMap.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

    links.forEach((link) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const startX = link.parent.x + 160;
        const startY = link.parent.y + 25;
        const endX = link.child.x;
        const endY = link.child.y + 25;
        const midX = (startX + endX) / 2;

        path.setAttribute("class", appState.deleteConnectionMode ? "visual-link deletable" : "visual-link");
        path.setAttribute("d", `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
        path.addEventListener("click", (event) => {
            event.stopPropagation();
            if (appState.deleteConnectionMode) {
                deleteConnection(link.parent.id, link.child.id);
            }
        });
        visualMap.appendChild(path);
    });

    layout.forEach((item) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

        group.setAttribute("class", getNodeClass(item.node.id));
        group.setAttribute("transform", `translate(${item.x}, ${item.y})`);
        group.addEventListener("click", () => selectVisualNode(item.node.id));

        rect.setAttribute("rx", "8");
        rect.setAttribute("width", "160");
        rect.setAttribute("height", "50");
        text.setAttribute("x", "80");
        text.setAttribute("y", "30");
        text.setAttribute("text-anchor", "middle");
        text.textContent = truncateNodeTitle(item.node.title);

        group.append(rect, text);
        visualMap.appendChild(group);
    });

    updateSelectedNodeInput();

    function layoutTree(node, depth) {
        const startLeaf = leafIndex;
        node.children.forEach((child) => {
            layoutTree(child, depth + 1);
            links.push({ parent: node, child });
        });
        if (node.children.length === 0) {
            leafIndex += 1;
        }
        const endLeaf = Math.max(leafIndex - 1, startLeaf);
        node.x = 30 + depth * 230;
        node.y = 30 + ((startLeaf + endLeaf) / 2) * 86;
        layout.push({ node, x: node.x, y: node.y });
    }
}

function getNodeClass(nodeId) {
    const classes = ["visual-node"];
    if (nodeId === appState.selectedNodeId) {
        classes.push("selected");
    }
    if (nodeId === appState.connectFromId) {
        classes.push("connecting");
    }
    return classes.join(" ");
}

function selectVisualNode(nodeId) {
    if (appState.connectFromId && appState.connectFromId !== nodeId) {
        connectNodes(appState.connectFromId, nodeId);
        appState.connectFromId = null;
        return;
    }

    appState.selectedNodeId = nodeId;
    renderVisualEditor();
}

function updateSelectedNodeInput() {
    const selected = findNode(appState.tree, appState.selectedNodeId);
    document.getElementById("nodeTitleInput").value = selected?.title || "";
}

function renameSelectedNode() {
    const selected = findNode(appState.tree, appState.selectedNodeId);
    const value = document.getElementById("nodeTitleInput").value.trim();

    if (!selected || !value) {
        return;
    }

    selected.title = value;
    syncTreeToMermaid();
}

function addChildNode() {
    const selected = findNode(appState.tree, appState.selectedNodeId);
    if (!selected) {
        return;
    }

    const child = { id: createNodeId(), title: "New node", children: [] };
    selected.children.push(child);
    appState.selectedNodeId = child.id;
    syncTreeToMermaid();
}

function addSiblingNode() {
    if (!appState.tree || appState.selectedNodeId === appState.tree.id) {
        addChildNode();
        return;
    }

    const parent = findParent(appState.tree, appState.selectedNodeId);
    if (!parent) {
        return;
    }

    const sibling = { id: createNodeId(), title: "New node", children: [] };
    parent.children.push(sibling);
    appState.selectedNodeId = sibling.id;
    syncTreeToMermaid();
}

function deleteSelectedNode() {
    if (!appState.tree || appState.selectedNodeId === appState.tree.id) {
        showAlert("resultsAlert", "The root node cannot be deleted.", "error");
        return;
    }

    const parent = findParent(appState.tree, appState.selectedNodeId);
    if (!parent) {
        return;
    }

    parent.children = parent.children.filter((child) => child.id !== appState.selectedNodeId);
    appState.selectedNodeId = parent.id;
    syncTreeToMermaid();
}

function startConnectingNodes() {
    if (!appState.selectedNodeId) {
        return;
    }

    appState.connectFromId = appState.selectedNodeId;
    appState.deleteConnectionMode = false;
    document.getElementById("deleteConnectionBtn").textContent = "Delete Connection";
    renderVisualEditor();
    showAlert("resultsAlert", "Select another node to move it under the highlighted node.", "info");
}

function toggleDeleteConnectionMode() {
    appState.deleteConnectionMode = !appState.deleteConnectionMode;
    appState.connectFromId = null;
    document.getElementById("deleteConnectionBtn").textContent = appState.deleteConnectionMode ? "Done" : "Delete Connection";
    renderVisualEditor();
    showAlert(
        "resultsAlert",
        appState.deleteConnectionMode
            ? "Click a highlighted connection to remove it. The child branch will move under the root."
            : "Connection deletion mode closed.",
        "info",
    );
}

function deleteConnection(parentId, childId) {
    if (!appState.tree || parentId === childId || childId === appState.tree.id) {
        return;
    }

    const parent = findNode(appState.tree, parentId);
    const child = findNode(appState.tree, childId);
    if (!parent || !child) {
        return;
    }

    const wasRootConnection = parent.id === appState.tree.id;
    parent.children = parent.children.filter((node) => node.id !== childId);
    if (parent.id === appState.tree.id) {
        getDetachedNode(child.id).children.push(child);
    } else {
        appState.tree.children.push(child);
    }

    appState.selectedNodeId = child.id;
    syncTreeToMermaid();
    showAlert(
        "resultsAlert",
        wasRootConnection
            ? "Connection removed. The branch was moved into Detached."
            : "Connection removed. The branch was moved under the root.",
        "success",
    );
}

function getDetachedNode(excludeId) {
    let detached = appState.tree.children.find((node) => node.title === "Detached" && node.id !== excludeId);

    if (!detached) {
        detached = { id: createNodeId(), title: "Detached", children: [] };
        appState.tree.children.push(detached);
    }

    return detached;
}

function connectNodes(parentId, childId) {
    if (parentId === childId || isDescendant(findNode(appState.tree, childId), parentId)) {
        showAlert("resultsAlert", "That connection would create a loop.", "error");
        return;
    }

    const newParent = findNode(appState.tree, parentId);
    const oldParent = findParent(appState.tree, childId);
    const child = findNode(appState.tree, childId);

    if (!newParent || !oldParent || !child || child.id === appState.tree.id) {
        return;
    }

    oldParent.children = oldParent.children.filter((node) => node.id !== childId);
    newParent.children.push(child);
    appState.selectedNodeId = childId;
    syncTreeToMermaid();
}

function syncTreeToMermaid() {
    appState.results.mermaid = treeToMermaid(appState.tree);
    mermaidOutput.value = appState.results.mermaid;
    appState.mermaidRendered = false;
    renderVisualEditor();
}

function findNode(node, id) {
    if (!node) {
        return null;
    }
    if (node.id === id) {
        return node;
    }
    for (const child of node.children) {
        const found = findNode(child, id);
        if (found) {
            return found;
        }
    }
    return null;
}

function findParent(node, childId) {
    if (!node) {
        return null;
    }
    if (node.children.some((child) => child.id === childId)) {
        return node;
    }
    for (const child of node.children) {
        const found = findParent(child, childId);
        if (found) {
            return found;
        }
    }
    return null;
}

function isDescendant(node, possibleDescendantId) {
    if (!node) {
        return false;
    }
    return node.children.some((child) => child.id === possibleDescendantId || isDescendant(child, possibleDescendantId));
}

function createNodeId() {
    return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function truncateNodeTitle(title) {
    return title.length > 22 ? `${title.slice(0, 19)}...` : title;
}

function getSvgBox(svg) {
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
        const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
        if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
            return { x, y, width, height };
        }
    }

    try {
        const box = svg.getBBox();
        if (box.width > 0 && box.height > 0) {
            return { x: box.x, y: box.y, width: Math.ceil(box.width), height: Math.ceil(box.height) };
        }
    } catch {
        // Fall through to attribute/client fallback.
    }

    return {
        x: 0,
        y: 0,
        width: Number.parseInt(svg.getAttribute("width"), 10) || svg.clientWidth || 1000,
        height: Number.parseInt(svg.getAttribute("height"), 10) || svg.clientHeight || 700,
    };
}

function embedSvgExportStyles(svg) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
        .visual-link { fill: none; stroke: #9aa8b8; stroke-width: 2; }
        .visual-node rect { fill: #ffffff; stroke: #9aa8b8; stroke-width: 1.5; }
        .visual-node text { fill: #1f2937; font: 13px Arial, sans-serif; }
        .visual-node.selected rect { fill: #eef5ff; stroke: #5f7f95; stroke-width: 2.5; }
        text { font-family: Arial, sans-serif; }
    `;
    svg.insertBefore(style, svg.firstChild);
}

function cloneData(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
}
