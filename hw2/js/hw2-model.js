(function () {
    "use strict";

    var INPUT_SIZE = 16;
    var NUM_CLASSES = 3;
    var CLASS_NAMES = ["Circle", "Square", "Triangle"];
    var STORAGE_KEY = "afeka_hw2_cnn_model";
    var DRAW_SIZE = 280;

    var samples = [];
    var model = null;
    var paramsLocked = false;
    var fixedConfig = null;

    var drawCanvas = document.getElementById("draw-canvas");
    var previewCanvas = document.getElementById("preview-grid");
    var drawCtx = drawCanvas.getContext("2d");
    var previewCtx = previewCanvas.getContext("2d");
    var isDrawing = false;

    function create2D(rows, cols, fill) {
        var m = [];
        var i;
        var j;
        for (i = 0; i < rows; i++) {
            m[i] = [];
            for (j = 0; j < cols; j++) {
                m[i][j] = fill !== undefined ? fill : 0;
            }
        }
        return m;
    }

    function create3D(depth, rows, cols, fill) {
        var t = [];
        var d;
        for (d = 0; d < depth; d++) {
            t[d] = create2D(rows, cols, fill);
        }
        return t;
    }

    function clone3D(tensor) {
        var out = [];
        var d;
        for (d = 0; d < tensor.length; d++) {
            out[d] = tensor[d].map(function (row) {
                return row.slice();
            });
        }
        return out;
    }

    function randomMatrix(rows, cols, scale) {
        var m = create2D(rows, cols, 0);
        var i;
        var j;
        for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
                m[i][j] = (Math.random() * 2 - 1) * scale;
            }
        }
        return m;
    }

    function initConvWeights(numFilters, inDepth, filterSize) {
        var scale = Math.sqrt(2 / (inDepth * filterSize * filterSize));
        var w = [];
        var f;
        var d;
        for (f = 0; f < numFilters; f++) {
            w[f] = [];
            for (d = 0; d < inDepth; d++) {
                w[f][d] = randomMatrix(filterSize, filterSize, scale);
            }
        }
        return w;
    }

    function reluScalar(x) {
        return x > 0 ? x : 0;
    }

    function relu3D(tensor) {
        return tensor.map(function (plane) {
            return plane.map(function (row) {
                return row.map(reluScalar);
            });
        });
    }

    function relu3DDerivative(tensor) {
        return tensor.map(function (plane) {
            return plane.map(function (row) {
                return row.map(function (v) {
                    return v > 0 ? 1 : 0;
                });
            });
        });
    }

    function softmax(vec) {
        var max = Math.max.apply(null, vec);
        var exps = vec.map(function (v) {
            return Math.exp(v - max);
        });
        var sum = exps.reduce(function (a, b) {
            return a + b;
        }, 0);
        return exps.map(function (v) {
            return v / sum;
        });
    }

    function oneHot(label) {
        var arr = [0, 0, 0];
        arr[label] = 1;
        return arr;
    }

    function crossEntropyLoss(probs, label) {
        var p = Math.max(probs[label], 1e-12);
        return -Math.log(p);
    }

    function convForward(input, weights, bias, filterSize) {
        var inDepth = input.length;
        var inH = input[0].length;
        var inW = input[0][0].length;
        var outH = inH - filterSize + 1;
        var outW = inW - filterSize + 1;
        var numFilters = weights.length;
        var output = [];
        var f;
        var y;
        var x;
        var sum;
        var d;
        var ky;
        var kx;

        for (f = 0; f < numFilters; f++) {
            var plane = create2D(outH, outW, 0);
            for (y = 0; y < outH; y++) {
                for (x = 0; x < outW; x++) {
                    sum = bias[f];
                    for (d = 0; d < inDepth; d++) {
                        for (ky = 0; ky < filterSize; ky++) {
                            for (kx = 0; kx < filterSize; kx++) {
                                sum += input[d][y + ky][x + kx] * weights[f][d][ky][kx];
                            }
                        }
                    }
                    plane[y][x] = sum;
                }
            }
            output.push(plane);
        }
        return output;
    }

    function maxPool2x2(tensor) {
        var masks = [];
        var pooled = tensor.map(function (plane) {
            var h = plane.length;
            var w = plane[0].length;
            var outH = Math.floor(h / 2);
            var outW = Math.floor(w / 2);
            var result = create2D(outH, outW, 0);
            var mask = create2D(h, w, 0);
            var y;
            var x;
            var maxVal;
            var maxY;
            var maxX;
            var py;
            var px;

            for (y = 0; y < outH; y++) {
                for (x = 0; x < outW; x++) {
                    maxVal = -Infinity;
                    maxY = y * 2;
                    maxX = x * 2;
                    for (py = 0; py < 2; py++) {
                        for (px = 0; px < 2; px++) {
                            if (plane[y * 2 + py][x * 2 + px] > maxVal) {
                                maxVal = plane[y * 2 + py][x * 2 + px];
                                maxY = y * 2 + py;
                                maxX = x * 2 + px;
                            }
                        }
                    }
                    result[y][x] = maxVal;
                    mask[maxY][maxX] = 1;
                }
            }
            masks.push(mask);
            return result;
        });
        return { output: pooled, masks: masks };
    }

    function maxPoolBackward(upstream, masks) {
        return upstream.map(function (plane, idx) {
            var mask = masks[idx];
            var h = mask.length;
            var w = mask[0].length;
            var grad = create2D(h, w, 0);
            var my;
            var mx;
            for (my = 0; my < h; my++) {
                for (mx = 0; mx < w; mx++) {
                    if (mask[my][mx] === 1) {
                        grad[my][mx] = plane[Math.floor(my / 2)][Math.floor(mx / 2)];
                    }
                }
            }
            return grad;
        });
    }

    function convBackward(input, weights, filterSize, gradOut) {
        var inDepth = input.length;
        var inH = input[0].length;
        var inW = input[0][0].length;
        var numFilters = weights.length;
        var gradInput = create3D(inDepth, inH, inW, 0);
        var gradWeights = [];
        var gradBias = [];
        var f;
        var d;
        var y;
        var x;
        var ky;
        var kx;

        for (f = 0; f < numFilters; f++) {
            gradBias[f] = 0;
            gradWeights[f] = [];
            for (d = 0; d < inDepth; d++) {
                gradWeights[f][d] = create2D(filterSize, filterSize, 0);
            }
            for (y = 0; y < gradOut[f].length; y++) {
                for (x = 0; x < gradOut[f][0].length; x++) {
                    var g = gradOut[f][y][x];
                    gradBias[f] += g;
                    for (d = 0; d < inDepth; d++) {
                        for (ky = 0; ky < filterSize; ky++) {
                            for (kx = 0; kx < filterSize; kx++) {
                                gradWeights[f][d][ky][kx] += g * input[d][y + ky][x + kx];
                                gradInput[d][y + ky][x + kx] += g * weights[f][d][ky][kx];
                            }
                        }
                    }
                }
            }
        }
        return { gradInput: gradInput, gradWeights: gradWeights, gradBias: gradBias };
    }

    function flatten3D(tensor) {
        var vec = [];
        var d;
        var y;
        var x;
        for (d = 0; d < tensor.length; d++) {
            for (y = 0; y < tensor[d].length; y++) {
                for (x = 0; x < tensor[d][0].length; x++) {
                    vec.push(tensor[d][y][x]);
                }
            }
        }
        return vec;
    }

    function denseForward(vec, weights, bias) {
        var out = [];
        var i;
        var j;
        for (i = 0; i < weights.length; i++) {
            var sum = bias[i];
            for (j = 0; j < vec.length; j++) {
                sum += weights[i][j] * vec[j];
            }
            out.push(sum);
        }
        return out;
    }

    function denseBackward(vec, weights, gradOut) {
        var gradVec = [];
        var j;
        var i;
        for (j = 0; j < vec.length; j++) {
            var g = 0;
            for (i = 0; i < weights.length; i++) {
                g += weights[i][j] * gradOut[i];
            }
            gradVec[j] = g;
        }
        var gradW = weights.map(function (row, i) {
            return row.map(function (_, j) {
                return gradOut[i] * vec[j];
            });
        });
        var gradB = gradOut.slice();
        return { gradVec: gradVec, gradWeights: gradW, gradBias: gradB };
    }

    function vectorToTensor(vec, depth, size) {
        var tensor = create3D(depth, size, size, 0);
        var idx = 0;
        var d;
        var y;
        var x;
        for (d = 0; d < depth; d++) {
            for (y = 0; y < size; y++) {
                for (x = 0; x < size; x++) {
                    tensor[d][y][x] = vec[idx++];
                }
            }
        }
        return tensor;
    }

    function gridToTensor(grid) {
        var mat = create2D(INPUT_SIZE, INPUT_SIZE, 0);
        var i;
        for (i = 0; i < grid.length; i++) {
            mat[Math.floor(i / INPUT_SIZE)][i % INPUT_SIZE] = grid[i];
        }
        return [mat];
    }

    function ShapeCNN(config) {
        this.config = config;
        this.convLayers = [];
        this.hiddenW = null;
        this.hiddenB = null;
        this.outputW = null;
        this.outputB = null;
        this.cache = null;
        this.build();
    }

    ShapeCNN.prototype.build = function () {
        var cfg = this.config;
        var spatial = INPUT_SIZE;
        var depth = 1;
        var li;
        var layer;

        this.convLayers = [];
        for (li = 0; li < cfg.numLayers; li++) {
            layer = {
                weights: initConvWeights(cfg.numFilters, depth, cfg.filterSize),
                bias: [],
                filterSize: cfg.filterSize
            };
            var f;
            for (f = 0; f < cfg.numFilters; f++) {
                layer.bias[f] = 0;
            }
            this.convLayers.push(layer);
            spatial = spatial - cfg.filterSize + 1;
            spatial = Math.floor(spatial / 2);
            depth = cfg.numFilters;
        }

        var flatSize = depth * spatial * spatial;
        var scaleH = Math.sqrt(2 / flatSize);
        this.hiddenW = randomMatrix(cfg.denseNeurons, flatSize, scaleH);
        this.hiddenB = [];
        var i;
        for (i = 0; i < cfg.denseNeurons; i++) {
            this.hiddenB[i] = 0;
        }
        this.outputW = randomMatrix(NUM_CLASSES, cfg.denseNeurons, Math.sqrt(2 / cfg.denseNeurons));
        this.outputB = [0, 0, 0];
    };

    ShapeCNN.prototype.forward = function (grid) {
        var tensor = gridToTensor(grid);
        var cache = { input: clone3D(tensor), conv: [] };
        var t = tensor;
        var li;
        var layer;
        var convOut;
        var reluOut;
        var poolResult;

        for (li = 0; li < this.convLayers.length; li++) {
            layer = this.convLayers[li];
            convOut = convForward(t, layer.weights, layer.bias, layer.filterSize);
            reluOut = relu3D(convOut);
            poolResult = maxPool2x2(reluOut);
            cache.conv.push({
                input: clone3D(t),
                preRelu: convOut,
                relu: reluOut,
                poolMasks: poolResult.masks
            });
            t = poolResult.output;
        }

        var flat = flatten3D(t);
        cache.tensorDepth = t.length;
        cache.tensorSize = t[0].length;
        var hiddenPre = denseForward(flat, this.hiddenW, this.hiddenB);
        var hidden = hiddenPre.map(reluScalar);
        var logits = denseForward(hidden, this.outputW, this.outputB);
        var probs = softmax(logits);

        cache.flat = flat;
        cache.hiddenPre = hiddenPre;
        cache.hidden = hidden;
        cache.logits = logits;
        cache.probs = probs;
        this.cache = cache;
        return probs;
    };

    ShapeCNN.prototype.backward = function (label, learningRate) {
        var cache = this.cache;
        var probs = cache.probs;
        var gradLogits = probs.slice();
        var i;
        gradLogits[label] -= 1;

        var outBw = denseBackward(cache.hidden, this.outputW, gradLogits);
        var gradHidden = outBw.gradVec.map(function (g, idx) {
            return g * (cache.hiddenPre[idx] > 0 ? 1 : 0);
        });

        var hidBw = denseBackward(cache.flat, this.hiddenW, gradHidden);
        var gradTensor = vectorToTensor(hidBw.gradVec, cache.tensorDepth, cache.tensorSize);

        var li = this.convLayers.length - 1;
        var gradOut = gradTensor;

        while (li >= 0) {
            var c = cache.conv[li];
            var layer = this.convLayers[li];
            gradOut = maxPoolBackward(gradOut, c.poolMasks);
            gradOut = gradOut.map(function (plane, fi) {
                return plane.map(function (row, y) {
                    return row.map(function (val, x) {
                        return val * (c.preRelu[fi][y][x] > 0 ? 1 : 0);
                    });
                });
            });
            var convBw = convBackward(c.input, layer.weights, layer.filterSize, gradOut);
            var f;
            var d;
            var ky;
            var kx;
            for (f = 0; f < layer.weights.length; f++) {
                layer.bias[f] -= learningRate * convBw.gradBias[f];
                for (d = 0; d < layer.weights[f].length; d++) {
                    for (ky = 0; ky < layer.filterSize; ky++) {
                        for (kx = 0; kx < layer.filterSize; kx++) {
                            layer.weights[f][d][ky][kx] -= learningRate * convBw.gradWeights[f][d][ky][kx];
                        }
                    }
                }
            }
            gradOut = convBw.gradInput;
            li--;
        }

        for (i = 0; i < this.outputW.length; i++) {
            for (var j = 0; j < this.outputW[i].length; j++) {
                this.outputW[i][j] -= learningRate * outBw.gradWeights[i][j];
            }
            this.outputB[i] -= learningRate * outBw.gradBias[i];
        }
        for (i = 0; i < this.hiddenW.length; i++) {
            for (j = 0; j < this.hiddenW[i].length; j++) {
                this.hiddenW[i][j] -= learningRate * hidBw.gradWeights[i][j];
            }
            this.hiddenB[i] -= learningRate * hidBw.gradBias[i];
        }
    };

    ShapeCNN.prototype.trainEpoch = function (data, learningRate) {
        var totalLoss = 0;
        var correct = 0;
        var n = data.length;
        var idx;
        var item;
        var probs;
        var pred;

        for (idx = 0; idx < n; idx++) {
            item = data[idx];
            probs = this.forward(item.grid);
            totalLoss += crossEntropyLoss(probs, item.label);
            pred = probs.indexOf(Math.max.apply(null, probs));
            if (pred === item.label) {
                correct++;
            }
            this.backward(item.label, learningRate);
        }
        return { loss: totalLoss / n, accuracy: correct / n };
    };

    ShapeCNN.prototype.serialize = function () {
        return {
            config: this.config,
            convLayers: this.convLayers,
            hiddenW: this.hiddenW,
            hiddenB: this.hiddenB,
            outputW: this.outputW,
            outputB: this.outputB
        };
    };

    ShapeCNN.load = function (data) {
        var net = Object.create(ShapeCNN.prototype);
        net.config = data.config;
        net.convLayers = data.convLayers;
        net.hiddenW = data.hiddenW;
        net.hiddenB = data.hiddenB;
        net.outputW = data.outputW;
        net.outputB = data.outputB;
        net.cache = null;
        return net;
    };

    function readParamsFromUI() {
        return {
            numLayers: parseInt(document.getElementById("param-layers").value, 10),
            numFilters: parseInt(document.getElementById("param-filters").value, 10),
            filterSize: parseInt(document.getElementById("param-filter-size").value, 10),
            denseNeurons: parseInt(document.getElementById("param-neurons").value, 10),
            learningRate: parseFloat(document.getElementById("param-lr").value),
            epochs: parseInt(document.getElementById("param-epochs").value, 10)
        };
    }

    function lockParamsUI() {
        paramsLocked = true;
        var ids = ["param-layers", "param-filters", "param-filter-size", "param-neurons", "param-lr", "param-epochs"];
        ids.forEach(function (id) {
            document.getElementById(id).disabled = true;
        });
        document.getElementById("params-lock-msg").textContent =
            "Parameters are locked after the first training run (per assignment requirements).";
    }

    function extractGridFromCanvas() {
        var temp = document.createElement("canvas");
        temp.width = INPUT_SIZE;
        temp.height = INPUT_SIZE;
        var tctx = temp.getContext("2d");
        tctx.fillStyle = "#ffffff";
        tctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
        tctx.drawImage(drawCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE);
        var img = tctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
        var grid = [];
        var i;
        for (i = 0; i < img.data.length; i += 4) {
            var gray = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
            var inv = 1 - gray / 255;
            grid.push(inv);
        }
        return grid;
    }

    function renderPreview(grid) {
        var cell = previewCanvas.width / INPUT_SIZE;
        previewCtx.fillStyle = "#111";
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        var i;
        for (i = 0; i < grid.length; i++) {
            var x = (i % INPUT_SIZE) * cell;
            var y = Math.floor(i / INPUT_SIZE) * cell;
            var v = Math.floor(grid[i] * 255);
            previewCtx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
            previewCtx.fillRect(x, y, cell, cell);
        }
    }

    function setupCanvas() {
        drawCtx.fillStyle = "#ffffff";
        drawCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
        drawCtx.strokeStyle = "#111827";
        drawCtx.lineWidth = 14;
        drawCtx.lineCap = "round";
        drawCtx.lineJoin = "round";

        function pos(e) {
            var rect = drawCanvas.getBoundingClientRect();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (DRAW_SIZE / rect.width),
                y: (clientY - rect.top) * (DRAW_SIZE / rect.height)
            };
        }

        function start(e) {
            e.preventDefault();
            isDrawing = true;
            var p = pos(e);
            drawCtx.beginPath();
            drawCtx.moveTo(p.x, p.y);
        }

        function move(e) {
            if (!isDrawing) {
                return;
            }
            e.preventDefault();
            var p = pos(e);
            drawCtx.lineTo(p.x, p.y);
            drawCtx.stroke();
            renderPreview(extractGridFromCanvas());
        }

        function end() {
            isDrawing = false;
            renderPreview(extractGridFromCanvas());
        }

        drawCanvas.addEventListener("mousedown", start);
        drawCanvas.addEventListener("mousemove", move);
        drawCanvas.addEventListener("mouseup", end);
        drawCanvas.addEventListener("mouseleave", end);
        drawCanvas.addEventListener("touchstart", start, { passive: false });
        drawCanvas.addEventListener("touchmove", move, { passive: false });
        drawCanvas.addEventListener("touchend", end);
    }

    function updateSampleUI() {
        document.getElementById("sample-count").textContent = String(samples.length);
        document.getElementById("stat-samples").textContent = String(samples.length);
        var list = document.getElementById("sample-list");
        list.innerHTML = "";
        samples.forEach(function (s, idx) {
            var li = document.createElement("li");
            li.textContent = "#" + (idx + 1) + " – " + CLASS_NAMES[s.label];
            list.appendChild(li);
        });
    }

    function saveToStorage() {
        var payload = {
            weights: model ? model.serialize() : null,
            samples: samples,
            paramsLocked: paramsLocked,
            fixedConfig: fixedConfig
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    function loadFromStorage() {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return false;
        }
        try {
            var data = JSON.parse(raw);
            if (data.weights) {
                model = ShapeCNN.load(data.weights);
                fixedConfig = data.fixedConfig || data.weights.config;
            }
            samples = data.samples || [];
            paramsLocked = !!data.paramsLocked;
            if (paramsLocked) {
                lockParamsUI();
                applyConfigToUI(fixedConfig);
            }
            updateSampleUI();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    function applyConfigToUI(cfg) {
        if (!cfg) {
            return;
        }
        document.getElementById("param-layers").value = cfg.numLayers;
        document.getElementById("param-filters").value = cfg.numFilters;
        document.getElementById("param-filter-size").value = String(cfg.filterSize);
        document.getElementById("param-neurons").value = cfg.denseNeurons;
        document.getElementById("param-lr").value = cfg.learningRate;
        document.getElementById("param-epochs").value = cfg.epochs;
    }

    function generateShapeGrid(type, jitter) {
        var grid = [];
        var cx = 7.5;
        var cy = 7.5;
        var y;
        var x;
        var dx;
        var dy;
        var inside;
        jitter = jitter || 0;

        for (y = 0; y < INPUT_SIZE; y++) {
            for (x = 0; x < INPUT_SIZE; x++) {
                dx = x - cx + (Math.random() - 0.5) * jitter;
                dy = y - cy + (Math.random() - 0.5) * jitter;
                inside = 0;
                if (type === 0) {
                    inside = dx * dx + dy * dy < 20 ? 1 : 0;
                } else if (type === 1) {
                    inside = Math.abs(dx) < 5 && Math.abs(dy) < 5 ? 1 : 0;
                } else {
                    inside = dy > -0.6 * dx - 2 && dy > 0.6 * dx - 2 && dy < 5 ? 1 : 0;
                }
                grid.push(inside + (Math.random() * 0.05));
            }
        }
        return grid;
    }

    function buildBootstrapSamples() {
        var list = [];
        var label;
        var k;
        for (label = 0; label < NUM_CLASSES; label++) {
            for (k = 0; k < 25; k++) {
                list.push({ label: label, grid: generateShapeGrid(label, 1.2) });
            }
        }
        return list;
    }

    function bootstrapModel() {
        var cfg = {
            numLayers: 2,
            numFilters: 8,
            filterSize: 3,
            denseNeurons: 32,
            learningRate: 0.08,
            epochs: 50
        };
        fixedConfig = cfg;
        model = new ShapeCNN(cfg);
        var data = buildBootstrapSamples();
        samples = data.slice(0, 30);
        var ep;
        for (ep = 0; ep < cfg.epochs; ep++) {
            model.trainEpoch(data, cfg.learningRate);
        }
        paramsLocked = true;
        lockParamsUI();
        applyConfigToUI(cfg);
        saveToStorage();
        updateSampleUI();
        setStatus(cfg.epochs, 0.15, 0.92, data.length);
    }

    function setStatus(epoch, loss, acc, sampleN) {
        document.getElementById("stat-epoch").textContent = String(epoch);
        document.getElementById("stat-loss").textContent = typeof loss === "number" ? loss.toFixed(4) : "–";
        document.getElementById("stat-accuracy").textContent =
            typeof acc === "number" ? (acc * 100).toFixed(1) + "%" : "–";
        document.getElementById("stat-samples").textContent = String(sampleN !== undefined ? sampleN : samples.length);
        var fill = document.getElementById("progress-fill");
        if (fixedConfig && epoch) {
            fill.style.width = Math.min(100, (epoch / fixedConfig.epochs) * 100) + "%";
        }
    }

    function showPrediction(probs) {
        var best = 0;
        var i;
        for (i = 1; i < probs.length; i++) {
            if (probs[i] > probs[best]) {
                best = i;
            }
        }
        document.getElementById("predict-label").textContent =
            "Prediction: " + CLASS_NAMES[best] + " (confidence " + (probs[best] * 100).toFixed(1) + "%)";

        var bars = document.getElementById("confidence-bars");
        bars.innerHTML = "";
        probs.forEach(function (p, idx) {
            var row = document.createElement("div");
            row.className = "conf-row";
            row.innerHTML =
                "<span>" + CLASS_NAMES[idx] + "</span>" +
                '<div class="conf-track"><div class="conf-fill" style="width:' + (p * 100).toFixed(1) + '%"></div></div>' +
                "<span>" + (p * 100).toFixed(1) + "%</span>";
            bars.appendChild(row);
        });
    }

    document.getElementById("btn-clear").addEventListener("click", function () {
        drawCtx.fillStyle = "#ffffff";
        drawCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
        renderPreview(extractGridFromCanvas());
    });

    document.getElementById("btn-add-sample").addEventListener("click", function () {
        var label = parseInt(document.getElementById("class-select").value, 10);
        var grid = extractGridFromCanvas();
        var sum = grid.reduce(function (a, b) {
            return a + b;
        }, 0);
        if (sum < 0.5) {
            alert("Draw a shape before adding a sample.");
            return;
        }
        samples.push({ label: label, grid: grid });
        updateSampleUI();
        saveToStorage();
    });

    document.getElementById("btn-train").addEventListener("click", function () {
        if (samples.length < 3) {
            alert("Add at least 3 samples (ideally from each class).");
            return;
        }
        var cfg = paramsLocked && fixedConfig ? fixedConfig : readParamsFromUI();
        if (!paramsLocked) {
            fixedConfig = cfg;
            model = new ShapeCNN(cfg);
            lockParamsUI();
        }
        if (!model) {
            model = new ShapeCNN(fixedConfig);
        }
        var ep;
        var result;
        for (ep = 1; ep <= cfg.epochs; ep++) {
            result = model.trainEpoch(samples, cfg.learningRate);
            setStatus(ep, result.loss, result.accuracy, samples.length);
        }
        saveToStorage();
        alert("Training finished. Loss: " + result.loss.toFixed(4) + ", Accuracy: " + (result.accuracy * 100).toFixed(1) + "%");
    });

    document.getElementById("btn-predict").addEventListener("click", function () {
        if (!model) {
            alert("No model loaded. Train or load a model first.");
            return;
        }
        var grid = extractGridFromCanvas();
        var probs = model.forward(grid);
        showPrediction(probs);
        renderPreview(grid);
    });

    document.getElementById("btn-reset").addEventListener("click", function () {
        if (!confirm("Reset the model, samples, and parameters?")) {
            return;
        }
        localStorage.removeItem(STORAGE_KEY);
        samples = [];
        paramsLocked = false;
        fixedConfig = null;
        ["param-layers", "param-filters", "param-filter-size", "param-neurons", "param-lr", "param-epochs"].forEach(function (id) {
            document.getElementById(id).disabled = false;
        });
        document.getElementById("params-lock-msg").textContent = "Parameters are editable before the first training run.";
        model = null;
        updateSampleUI();
        setStatus("–", "–", "–", 0);
        document.getElementById("predict-label").textContent = "No prediction yet";
        document.getElementById("confidence-bars").innerHTML = "";
        document.getElementById("progress-fill").style.width = "0%";
    });

    document.getElementById("btn-save").addEventListener("click", function () {
        if (!model) {
            alert("No model to save.");
            return;
        }
        saveToStorage();
        alert("Model saved to LocalStorage.");
    });

    document.getElementById("btn-load").addEventListener("click", function () {
        if (loadFromStorage()) {
            alert("Model loaded from LocalStorage.");
            if (model) {
                setStatus(fixedConfig ? fixedConfig.epochs : "–", "–", "–", samples.length);
            }
        } else {
            alert("No saved model found. Running initial training...");
            bootstrapModel();
        }
    });

    setupCanvas();
    renderPreview(extractGridFromCanvas());

    if (!loadFromStorage()) {
        bootstrapModel();
    } else if (!model) {
        bootstrapModel();
    } else {
        setStatus(fixedConfig ? fixedConfig.epochs : "–", "–", "–", samples.length);
    }
})();
