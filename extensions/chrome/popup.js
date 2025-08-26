// RecipeArchive popup
console.log("RecipeArchive popup loading");

document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElement("div");
    container.innerHTML = "<h1>RecipeArchive</h1><button id=\"capture\">Capture Recipe</button>";
    document.body.appendChild(container);
    
    document.getElementById("capture").onclick = function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "captureRecipe"});
        });
    };
});