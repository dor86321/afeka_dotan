(function () {
    "use strict";

    var TERMS = [
        { term: "AI", en: "Artificial Intelligence", desc: "A computer system's ability to perform tasks that require understanding, learning, or decision-making.", where: "Home page, README, this glossary" },
        { term: "Machine Learning", en: "Machine Learning", desc: "A field of AI where models learn patterns from data instead of hand-coded rules.", where: "README, home page intro" },
        { term: "Deep Learning", en: "Deep Learning", desc: "Using neural networks with many layers to learn complex representations.", where: "Glossary, README" },
        { term: "Neural Network", en: "Neural Network", desc: "A computational model of connected layers that process input and produce output.", where: "ShapeCNN in hw2-model.js" },
        { term: "CNN", en: "Convolutional Neural Network", desc: "A network suited to spatial data such as images or pixel grids.", where: "hw2/index.html, ShapeCNN" },
        { term: "Convolution", en: "Convolution", desc: "Sliding a filter over input to compute local features (edges, shapes).", where: "convForward function in hw2-model.js" },
        { term: "Filter", en: "Filter", desc: "A weight matrix that slides over input and highlights a specific pattern.", where: "'Filters' parameter in the UI" },
        { term: "Kernel", en: "Kernel", desc: "The filter window size (e.g. 3×3) used in convolution.", where: "param-filter-size, convForward" },
        { term: "Feature Map", en: "Feature Map", desc: "Output of a Conv layer after applying filters; represents a detected feature.", where: "convForward output, cache.conv" },
        { term: "Pooling", en: "Pooling", desc: "Reducing dimensions while keeping important information, e.g. taking the maximum value.", where: "maxPool2x2 in hw2-model.js" },
        { term: "Max Pooling", en: "Max Pooling", desc: "Selecting the maximum value in each 2×2 window to shrink the network.", where: "maxPool2x2, maxPoolBackward" },
        { term: "Neuron", en: "Neuron", desc: "A computation unit that computes a weighted sum and then applies an activation.", where: "Dense layers in ShapeCNN" },
        { term: "Layer", en: "Layer", desc: "A network component (Conv, Pooling, Dense) that processes data in sequence.", where: "param-layers, convLayers" },
        { term: "Input Layer", en: "Input Layer", desc: "The 16×16 grid coming from Canvas pixels.", where: "gridToTensor, extractGridFromCanvas" },
        { term: "Hidden Layer", en: "Hidden Layer", desc: "Intermediate layers (Conv + Dense) between input and output.", where: "hiddenW, convLayers" },
        { term: "Output Layer", en: "Output Layer", desc: "Three neurons for the three classes (circle, square, triangle).", where: "outputW, outputB, softmax" },
        { term: "ReLU", en: "Rectified Linear Unit", desc: "Activation function max(0,x) – removes negative values and speeds training.", where: "reluScalar, relu3D in hw2-model.js" },
        { term: "Sigmoid", en: "Sigmoid", desc: "Activation that maps values to (0,1) – common in binary problems.", where: "Glossary (comparison); this project uses ReLU+Softmax" },
        { term: "Softmax", en: "Softmax", desc: "Converts a score vector into probabilities that sum to 1 – for multi-class classification.", where: "softmax function in hw2-model.js" },
        { term: "Forward Pass", en: "Forward Pass", desc: "Computing model output from input through all layers.", where: "ShapeCNN.prototype.forward" },
        { term: "Backpropagation", en: "Backpropagation", desc: "Computing gradients and updating weights from the error.", where: "ShapeCNN.prototype.backward" },
        { term: "Weights", en: "Weights", desc: "Learned parameters that determine connection strength between neurons.", where: "conv layers, hiddenW, outputW; saved in LocalStorage" },
        { term: "Bias", en: "Bias", desc: "A constant added before activation, allowing extra flexibility.", where: "bias in convLayers, hiddenB, outputB arrays" },
        { term: "Learning Rate", en: "Learning Rate", desc: "Step size when updating weights on each iteration.", where: "param-lr, trainEpoch, backward" },
        { term: "Loss", en: "Loss", desc: "Error measure for the model; lower values mean better fit.", where: "stat-loss, crossEntropyLoss" },
        { term: "Loss Function", en: "Loss Function", desc: "Formal loss definition – in this project: Cross-Entropy for classification.", where: "crossEntropyLoss" },
        { term: "Epoch", en: "Epoch", desc: "One pass over all training samples.", where: "param-epochs, training loop in btn-train" },
        { term: "Batch", en: "Batch", desc: "A group of samples processed together; here all samples per epoch.", where: "trainEpoch iterates over all samples" },
        { term: "Accuracy", en: "Accuracy", desc: "Percentage of correct predictions on training samples.", where: "stat-accuracy, trainEpoch" },
        { term: "Prediction", en: "Prediction", desc: "The class the model estimates for the current drawing.", where: "btn-predict, predict-label" },
        { term: "Classification", en: "Classification", desc: "Assigning input to one of several fixed categories.", where: "3 classes: circle, square, triangle" },
        { term: "Training Data", en: "Training Data", desc: "A collection of labeled drawings the user adds.", where: "samples array, btn-add-sample" },
        { term: "Label", en: "Label", desc: "The correct class of a sample (0, 1, or 2).", where: "class-select, oneHot" },
        { term: "Overfitting", en: "Overfitting", desc: "The model memorizes training data and fails to generalize to new drawings.", where: "Glossary; use varied samples" },
        { term: "Underfitting", en: "Underfitting", desc: "The model learns too little (too few layers/epochs).", where: "Glossary; try increasing epochs" },
        { term: "Gradient Descent", en: "Gradient Descent", desc: "Updating weights in the direction that reduces loss.", where: "backward updates weights with learningRate" },
        { term: "Activation Function", en: "Activation Function", desc: "Turns a linear sum into a non-linear value (ReLU, Softmax).", where: "reluScalar, softmax" },
        { term: "Canvas", en: "Canvas", desc: "HTML element for bitmap drawing; here the network input source.", where: "draw-canvas in hw2/index.html" },
        { term: "Pixel Input", en: "Pixel Input", desc: "Converting the drawing to a normalized 16×16 value grid.", where: "extractGridFromCanvas" },
        { term: "LocalStorage", en: "LocalStorage", desc: "Browser local storage for weights and samples between visits.", where: "saveToStorage, loadFromStorage, STORAGE_KEY" },
        { term: "JSON", en: "JavaScript Object Notation", desc: "Text format for objects; used to save and load the model.", where: "JSON.stringify, JSON.parse" },
        { term: "Model Parameters", en: "Model Parameters", desc: "Layer count, filters, learning rate, epochs, etc.", where: "params-form, fixedConfig" },
        { term: "Initialization", en: "Weight Initialization", desc: "Small random start (Xavier-like) before training.", where: "initConvWeights, randomMatrix, bootstrapModel" },
        { term: "Normalization", en: "Normalization", desc: "Mapping pixel values to 0–1 range for stable training.", where: "extractGridFromCanvas (1 - gray/255)" },
        { term: "Confidence Score", en: "Confidence Score", desc: "The probability the model assigns to each class.", where: "confidence-bars, showPrediction" },
        { term: "Dense Layer", en: "Fully Connected Layer", desc: "Every neuron connects to all previous ones; used after the Conv stack.", where: "denseForward, hiddenW" },
        { term: "Flatten", en: "Flatten", desc: "Converting a 3D tensor to a single vector before a dense layer.", where: "flatten3D" },
        { term: "Cross-Entropy", en: "Cross-Entropy", desc: "Standard error measure for probabilistic classification.", where: "crossEntropyLoss" },
        { term: "One-Hot Encoding", en: "One-Hot", desc: "A vector with 1 at the correct class index and 0 elsewhere.", where: "oneHot (in code for illustration)" },
        { term: "Vanilla JavaScript", en: "Vanilla JS", desc: "Plain JavaScript with no external libraries or frameworks.", where: "All js/ files in the project" }
    ];

    function renderCards(filter, grid, countEl) {
        if (!grid) {
            return;
        }
        var q = (filter || "").trim().toLowerCase();
        var visible = 0;
        grid.innerHTML = "";

        TERMS.forEach(function (item) {
            var haystack = (item.term + " " + item.en + " " + item.desc + " " + item.where).toLowerCase();
            if (q && haystack.indexOf(q) === -1) {
                return;
            }
            visible++;
            var card = document.createElement("article");
            card.className = "dict-card";
            card.innerHTML =
                "<h3>" + item.term + "</h3>" +
                "<p class=\"en\">" + item.en + "</p>" +
                "<p class=\"desc\">" + item.desc + "</p>" +
                "<p class=\"where\"><strong>In project:</strong> " + item.where + "</p>";
            grid.appendChild(card);
        });

        if (countEl) {
            countEl.textContent = "Showing " + visible + " of " + TERMS.length + " terms";
        }
    }

    function setupDictionary(gridId, searchId, countId) {
        var grid = document.getElementById(gridId);
        var searchInput = searchId ? document.getElementById(searchId) : null;
        var countEl = countId ? document.getElementById(countId) : null;

        if (!grid) {
            return;
        }

        renderCards("", grid, countEl);

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                renderCards(searchInput.value, grid, countEl);
            });
        }
    }

    setupDictionary("dict-grid", "dict-search", "dict-count");
    setupDictionary("home-dict-grid", "home-dict-search", "home-dict-count");
})();
