(function () {
  var dimensionMode = 'global';
  var savedGlobalDimensions = { length: '', width: '', height: '' };
  var originalEnsureCombinationState = window.ensureCombinationState;
  var originalSyncCombination = window.syncCombination;
  var originalRenderMatrix = window.renderMatrix;
  var originalValidateModel = window.validateModel;
  var originalUpdateTask = API.updateTask.bind(API);

  function dimensionInputs() {
    return {
      length: document.getElementById('lengthCm'),
      width: document.getElementById('widthCm'),
      height: document.getElementById('heightCm'),
    };
  }

  function dimensionValue(value) {
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  function setGlobalDimensionState(disabled) {
    var inputs = dimensionInputs();
    Object.keys(inputs).forEach(function (key) {
      if (!inputs[key]) return;
      inputs[key].disabled = disabled;
      inputs[key].closest('.form-group')?.classList.toggle('dimension-disabled', disabled);
    });
    var hint = document.getElementById('globalDimensionHint');
    if (hint) hint.textContent = disabled ? '当前使用按 SKU 尺寸，请在 SKU 列表中填写。' : '留空表示不填写；填写时长、宽、高必须完整。';
  }

  function addDimensionControls() {
    if (document.getElementById('dimensionModeControl')) return;
    var matrix = document.getElementById('skuMatrix');
    var toolbar = matrix?.previousElementSibling;
    if (!matrix || !toolbar) return;
    var control = document.createElement('div');
    control.className = 'dimension-mode-row';
    control.id = 'dimensionModeControl';
    control.innerHTML = '<div><strong>包装尺寸</strong><span>默认全局共用，也可按 SKU 分别填写</span></div>'
      + '<div class="segmented dimension-mode-segmented">'
      + '<label><input type="radio" name="dimensionMode" value="global" checked><span>全局尺寸</span></label>'
      + '<label><input type="radio" name="dimensionMode" value="variant"><span>按 SKU 尺寸</span></label>'
      + '</div>';
    control.addEventListener('change', function (event) {
      if (event.target.name === 'dimensionMode') window.setDimensionMode(event.target.value);
    });
    toolbar.parentNode.insertBefore(control, toolbar);

    var lengthInput = document.getElementById('lengthCm');
    var dimensionsGrid = lengthInput?.closest('.field-grid');
    if (dimensionsGrid && !document.getElementById('globalDimensionHint')) {
      var hint = document.createElement('div');
      hint.className = 'global-dimension-hint';
      hint.id = 'globalDimensionHint';
      hint.textContent = '留空表示不填写；填写时长、宽、高必须完整。';
      dimensionsGrid.parentNode.insertBefore(hint, dimensionsGrid);
    }
  }

  window.ensureCombinationState = function (combo) {
    var state = originalEnsureCombinationState(combo);
    if (state.length === undefined) state.length = dimensionMode === 'variant' ? savedGlobalDimensions.length : '';
    if (state.width === undefined) state.width = dimensionMode === 'variant' ? savedGlobalDimensions.width : '';
    if (state.height === undefined) state.height = dimensionMode === 'variant' ? savedGlobalDimensions.height : '';
    return state;
  };

  window.syncCombination = function (input) {
    var fields = { dimensionLength: 'length', dimensionWidth: 'width', dimensionHeight: 'height' };
    if (!fields[input.dataset.field]) return originalSyncCombination(input);
    var row = input.closest('.sku-row');
    var state = combinationState[row?.dataset.key];
    if (!state) return;
    state[fields[input.dataset.field]] = input.value;
  };

  function renderVariantDimensionRows() {
    if (dimensionMode !== 'variant') return;
    document.querySelectorAll('#skuMatrix .sku-row').forEach(function (row) {
      var state = combinationState[row.dataset.key];
      if (!state) return;
      var dimensions = document.createElement('div');
      dimensions.className = 'sku-dimensions';
      dimensions.innerHTML = '<span class="sku-dimensions-label">包装尺寸 <small>cm</small></span>'
        + '<label><span>长</span><input type="number" class="form-input" data-field="dimensionLength" min="0.01" max="10000000" step="0.1" value="' + escapeHtml(state.length) + '" oninput="syncCombination(this)"></label>'
        + '<label><span>宽</span><input type="number" class="form-input" data-field="dimensionWidth" min="0.01" max="10000000" step="0.1" value="' + escapeHtml(state.width) + '" oninput="syncCombination(this)"></label>'
        + '<label><span>高</span><input type="number" class="form-input" data-field="dimensionHeight" min="0.01" max="10000000" step="0.1" value="' + escapeHtml(state.height) + '" oninput="syncCombination(this)"></label>';
      row.appendChild(dimensions);
    });
  }

  window.renderMatrix = function () {
    originalRenderMatrix();
    document.getElementById('skuMatrix')?.classList.toggle('has-variant-dimensions', dimensionMode === 'variant');
    renderVariantDimensionRows();
  };

  window.setDimensionMode = function (mode) {
    var next = mode === 'variant' ? 'variant' : 'global';
    if (next === dimensionMode) return;
    var inputs = dimensionInputs();
    if (next === 'variant') {
      Object.keys(inputs).forEach(function (key) {
        savedGlobalDimensions[key] = inputs[key]?.value || '';
        if (inputs[key]) inputs[key].value = '';
      });
      getCombinations().forEach(function (combo) {
        var state = window.ensureCombinationState(combo);
        if (!state.length && !state.width && !state.height) {
          state.length = savedGlobalDimensions.length;
          state.width = savedGlobalDimensions.width;
          state.height = savedGlobalDimensions.height;
        }
      });
    } else {
      Object.keys(inputs).forEach(function (key) {
        if (inputs[key]) inputs[key].value = savedGlobalDimensions[key];
      });
    }
    dimensionMode = next;
    setGlobalDimensionState(next === 'variant');
    window.renderMatrix();
  };

  window.validateModel = function () {
    var error = originalValidateModel();
    if (error || dimensionMode !== 'variant') return error;
    var combinations = getEnabledCombinations();
    for (var i = 0; i < combinations.length; i++) {
      var state = window.ensureCombinationState(combinations[i]);
      var values = [state.length, state.width, state.height];
      var filled = values.filter(function (value) { return value !== ''; }).length;
      if (filled !== 0 && filled !== 3) return combinations[i].label + ' 的长、宽、高必须同时填写或全部留空';
      if (values.some(function (value) { return value !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 10000000); })) return combinations[i].label + ' 的尺寸必须大于 0 且不超过 10000000cm';
    }
    return '';
  };

  API.updateTask = function (taskId, payload) {
    if (!payload || !Array.isArray(payload.variations)) return originalUpdateTask(taskId, payload);
    var combinations = getEnabledCombinations();
    var updated = Object.assign({}, payload, {
      dimension_mode: dimensionMode,
      length_cm: dimensionMode === 'global' ? payload.length_cm : null,
      width_cm: dimensionMode === 'global' ? payload.width_cm : null,
      height_cm: dimensionMode === 'global' ? payload.height_cm : null,
      variations: payload.variations.map(function (variation, index) {
        var state = window.ensureCombinationState(combinations[index]);
        return Object.assign({}, variation, {
          length_cm: dimensionMode === 'variant' ? dimensionValue(state.length) : null,
          width_cm: dimensionMode === 'variant' ? dimensionValue(state.width) : null,
          height_cm: dimensionMode === 'variant' ? dimensionValue(state.height) : null,
        });
      }),
    });
    return originalUpdateTask(taskId, updated);
  };

  var style = document.createElement('style');
  style.textContent = '.matrix{overflow-x:auto}.matrix-head,.sku-row{min-width:720px}'
    + '.dimension-mode-row{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:18px;padding:11px 12px;border:1px solid var(--shopee-line);border-radius:8px;background:var(--shopee-soft)}'
    + '.dimension-mode-row>div:first-child{min-width:0}.dimension-mode-row strong{display:block;color:#344054;font-size:13px}.dimension-mode-row>div:first-child span{display:block;margin-top:2px;color:var(--shopee-muted);font-size:11px}'
    + '.dimension-mode-segmented{flex:0 0 250px}.dimension-mode-segmented span{font-size:12px}'
    + '.sku-dimensions{grid-column:1/-1;display:grid;grid-template-columns:135px repeat(3,minmax(110px,1fr));gap:10px;align-items:end;padding:11px 0 2px;border-top:1px solid var(--shopee-line)}'
    + '.sku-dimensions-label{align-self:center;color:#344054;font-size:12px;font-weight:700}.sku-dimensions-label small{color:var(--shopee-muted);font-size:10px;font-weight:500}'
    + '.sku-dimensions label>span{display:block;margin-bottom:4px;color:var(--shopee-muted);font-size:10px}.global-dimension-hint{margin:-4px 0 12px;color:var(--shopee-muted);font-size:11px}'
    + '.dimension-disabled{opacity:.55}.dimension-disabled .form-input{cursor:not-allowed;background:#f2f4f7}'
    + '@media(max-width:760px){.dimension-mode-row{align-items:stretch;flex-direction:column}.dimension-mode-segmented{flex-basis:auto;width:100%}.sku-dimensions{grid-template-columns:110px repeat(3,minmax(100px,1fr))}}';
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', function () {
    addDimensionControls();
    setGlobalDimensionState(false);
    window.renderMatrix();
  });
})();
