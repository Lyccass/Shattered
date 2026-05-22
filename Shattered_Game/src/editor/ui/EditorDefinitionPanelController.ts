import {
  clamp,
  drawDefinitionColorPreview,
  drawDefinitionFitPreview,
  drawDefinitionFitStage,
  getDefaultDefinitionFitScale,
  getDefinitionFitFootprint,
  loadImageFromDataUrl,
  parseIntegerInput,
  parseNumberInput,
  prepareDefinitionImageDataUrl,
  readFileAsDataUrl,
  type DefinitionFitDraft,
  type DefinitionFitProjection,
  type EditorAssetKind,
  type PreparedDefinitionImage,
} from '../assets/EditorDefinitionImage';

export type EditorDefinitionCreateValues = {
  category: string;
  flag: boolean;
  footprintHeight: number;
  footprintWidth: number;
  id: string;
  name: string;
  textureDataUrl?: string;
  textureHeight?: number;
  textureKey?: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  textureWidth?: number;
};

export type EditorDefinitionPanelOptions = {
  assetKind: EditorAssetKind;
  categoryValue: string;
  flagChecked: boolean;
  flagLabel: string;
  footprintHeight?: number;
  footprintWidth?: number;
  idValue: string;
  nameValue: string;
  onCreate: (values: EditorDefinitionCreateValues) => void;
  previewColor: number | null;
  previewSrc: string | null;
  title: string;
};

type EditorDefinitionPanelCallbacks = {
  loadTexture: (textureKey: string, dataUrl: string) => Promise<string>;
  setStatus: (message: string) => void;
};

export class EditorDefinitionPanelController {
  private eventsBound = false;
  private submitHandler: (() => void | Promise<void>) | null = null;

  constructor(private readonly callbacks: EditorDefinitionPanelCallbacks) {}

  bindGlobalEvents(): void {
    if (this.eventsBound) {
      return;
    }

    this.eventsBound = true;
    document.getElementById('ed-definition-close')?.addEventListener('click', () => this.close());
    document.getElementById('ed-definition-cancel')?.addEventListener('click', () => this.close());
    document.getElementById('ed-definition-create')?.addEventListener('click', () => {
      void this.submitHandler?.();
    });
  }

  show(options: EditorDefinitionPanelOptions): void {
    const elements = getDefinitionPanelElements();

    if (!elements) {
      return;
    }

    const {
      categoryInput,
      cleanInput,
      fileInput,
      fitApplyButton,
      fitButton,
      fitCancelButton,
      fitCloseButton,
      fitGrid,
      fitPanel,
      fitScaleNumber,
      fitScaleRange,
      fitSelection,
      fitStage,
      fitStageGrid,
      fitStageImage,
      flagInput,
      flagLabel,
      footprintHeightInput,
      footprintPanel,
      footprintWidthInput,
      idInput,
      nameInput,
      offsetXInput,
      offsetYInput,
      openFitButton,
      panel,
      preview,
      previewColor,
      previewImg,
      resizeHandle,
      scaleInput,
      title,
    } = elements;

    title.textContent = options.title;
    idInput.value = options.idValue;
    nameInput.value = options.nameValue;
    categoryInput.value = options.categoryValue;
    footprintPanel.classList.toggle('editor-hidden', options.assetKind !== 'object');
    footprintWidthInput.value = String(options.footprintWidth ?? 1);
    footprintHeightInput.value = String(options.footprintHeight ?? 1);
    flagInput.checked = options.flagChecked;
    flagLabel.textContent = options.flagLabel;
    fileInput.value = '';
    scaleInput.value = '1';
    offsetXInput.value = '0';
    offsetYInput.value = '0';
    cleanInput.checked = false;
    fitPanel.classList.add('editor-hidden');

    if (options.previewSrc) {
      previewImg.src = options.previewSrc;
      previewImg.classList.remove('editor-hidden');
      previewColor.classList.add('editor-hidden');
      resizeHandle.classList.remove('editor-hidden');
    } else {
      previewImg.classList.add('editor-hidden');
      previewColor.classList.remove('editor-hidden');
      resizeHandle.classList.add('editor-hidden');
      drawDefinitionColorPreview(previewColor, options.previewColor ?? 0xfacc15);
    }

    let pendingImage: PreparedDefinitionImage | null = null;
    let previewProjection = drawDefinitionFitPreview(
      preview,
      fitGrid,
      previewImg,
      resizeHandle,
      scaleInput,
      offsetXInput,
      offsetYInput,
      pendingImage,
      getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
    );

    const setPreviewImage = (image: PreparedDefinitionImage): void => {
      pendingImage = image;
      previewImg.src = image.dataUrl;
      previewImg.classList.remove('editor-hidden');
      previewColor.classList.add('editor-hidden');
      resizeHandle.classList.remove('editor-hidden');
      previewProjection = drawDefinitionFitPreview(
        preview,
        fitGrid,
        previewImg,
        resizeHandle,
        scaleInput,
        offsetXInput,
        offsetYInput,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
      );
    };

    if (options.previewSrc) {
      void loadImageFromDataUrl(options.previewSrc)
        .then((image) => {
          if (!pendingImage && options.previewSrc) {
            setPreviewImage({
              dataUrl: options.previewSrc,
              height: image.height,
              width: image.width,
            });
          }
        })
        .catch(() => {
          this.callbacks.setStatus('Could not prepare selected asset preview for fitting.');
        });
    }

    const prepareAndSetPreviewDataUrl = (rawDataUrl: string): void => {
      void prepareDefinitionImageDataUrl(rawDataUrl, options.assetKind, cleanInput.checked)
        .then(setPreviewImage)
        .catch((error: unknown) => {
          this.callbacks.setStatus(error instanceof Error ? error.message : 'Image import failed.');
        });
    };

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
    };
    cleanInput.onchange = () => {
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
    };
    panel.ondragover = (event) => {
      event.preventDefault();
    };
    panel.ondrop = (event) => {
      event.preventDefault();
      const file = Array.from(event.dataTransfer?.files ?? [])
        .find((candidate) => candidate.type.startsWith('image/'));

      if (file) {
        void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
      }
    };

    const updateFitPreview = (): void => {
      previewProjection = drawDefinitionFitPreview(
        preview,
        fitGrid,
        previewImg,
        resizeHandle,
        scaleInput,
        offsetXInput,
        offsetYInput,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
      );
    };
    const fitHandles = Array.from(fitSelection.querySelectorAll<HTMLDivElement>('.ed-fit-handle'));
    let fitPanelVisible = false;
    let fitDraft: DefinitionFitDraft | null = null;
    let fitProjection: DefinitionFitProjection | null = null;
    let fitMoveStart: {
      offsetX: number;
      offsetY: number;
      pointerX: number;
      pointerY: number;
    } | null = null;
    let fitResizeStart: {
      anchorX: number;
      anchorY: number;
      corner: string;
      oppositeX: number;
      oppositeY: number;
      startDistance: number;
      startScale: number;
      zoom: number;
    } | null = null;
    const syncFitScaleControls = (): void => {
      if (!fitDraft) {
        return;
      }

      const scale = String(Number(fitDraft.scale.toFixed(2)));
      fitScaleRange.value = scale;
      fitScaleNumber.value = scale;
    };
    const drawFitEditor = (): void => {
      if (!pendingImage || !fitDraft || !fitPanelVisible) {
        return;
      }

      syncFitScaleControls();
      fitProjection = drawDefinitionFitStage(
        fitStage,
        fitStageGrid,
        fitStageImage,
        fitSelection,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
        fitDraft,
      );
    };
    const closeFitEditor = (): void => {
      fitPanel.classList.add('editor-hidden');
      fitPanelVisible = false;
      fitMoveStart = null;
      fitResizeStart = null;
      fitDraft = null;
    };
    const openFitEditor = (): void => {
      if (!pendingImage) {
        this.callbacks.setStatus('Select or drop an image before opening the fit editor.');
        return;
      }

      fitDraft = {
        offsetX: parseNumberInput(offsetXInput.value, 0),
        offsetY: parseNumberInput(offsetYInput.value, 0),
        scale: clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4),
      };
      fitStageImage.src = pendingImage.dataUrl;
      fitPanel.classList.remove('editor-hidden');
      fitPanelVisible = true;
      drawFitEditor();
    };
    const updateFitDraftScale = (value: string): void => {
      if (!fitDraft) {
        return;
      }

      fitDraft.scale = clamp(parseNumberInput(value, fitDraft.scale), 0.05, 4);
      drawFitEditor();
    };
    const startFitMove = (event: PointerEvent): void => {
      if (!pendingImage || !fitDraft) {
        return;
      }

      event.preventDefault();
      fitStage.setPointerCapture(event.pointerId);
      fitMoveStart = {
        offsetX: fitDraft.offsetX,
        offsetY: fitDraft.offsetY,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    preview.ondblclick = openFitEditor;
    openFitButton.onclick = openFitEditor;
    fitCloseButton.onclick = closeFitEditor;
    fitCancelButton.onclick = closeFitEditor;
    fitScaleRange.oninput = () => updateFitDraftScale(fitScaleRange.value);
    fitScaleNumber.oninput = () => updateFitDraftScale(fitScaleNumber.value);
    fitApplyButton.onclick = () => {
      if (!fitDraft) {
        return;
      }

      scaleInput.value = String(Number(fitDraft.scale.toFixed(2)));
      offsetXInput.value = String(Math.round(fitDraft.offsetX));
      offsetYInput.value = String(Math.round(fitDraft.offsetY));
      updateFitPreview();
      closeFitEditor();
    };
    fitStageImage.onpointerdown = startFitMove;
    fitSelection.onpointerdown = startFitMove;
    fitStage.onpointermove = (event) => {
      if (fitMoveStart && fitDraft && fitProjection) {
        fitDraft.offsetX = fitMoveStart.offsetX + (event.clientX - fitMoveStart.pointerX) / fitProjection.zoom;
        fitDraft.offsetY = fitMoveStart.offsetY + (event.clientY - fitMoveStart.pointerY) / fitProjection.zoom;
        drawFitEditor();
        return;
      }

      if (fitResizeStart && fitDraft && pendingImage) {
        const currentDistance = Math.max(1, Math.hypot(
          event.clientX - fitResizeStart.oppositeX,
          event.clientY - fitResizeStart.oppositeY,
        ));
        const stageRect = fitStage.getBoundingClientRect();
        const oppositeX = fitResizeStart.oppositeX - stageRect.left;
        const oppositeY = fitResizeStart.oppositeY - stageRect.top;
        const nextScale = clamp(
          fitResizeStart.startScale * (currentDistance / fitResizeStart.startDistance),
          0.05,
          4,
        );
        const nextImageWidth = pendingImage.width * nextScale * fitResizeStart.zoom;
        const nextImageHeight = pendingImage.height * nextScale * fitResizeStart.zoom;
        const directionX = fitResizeStart.corner.includes('e') ? 1 : -1;
        const directionY = fitResizeStart.corner.includes('s') ? 1 : -1;
        const nextImageX = oppositeX + (nextImageWidth / 2) * directionX;
        const nextImageY = oppositeY + (nextImageHeight / 2) * directionY;

        fitDraft.scale = nextScale;
        fitDraft.offsetX = (nextImageX - fitResizeStart.anchorX) / fitResizeStart.zoom;
        fitDraft.offsetY = (nextImageY - fitResizeStart.anchorY) / fitResizeStart.zoom;
        drawFitEditor();
      }
    };
    fitStage.onpointerup = () => {
      fitMoveStart = null;
      fitResizeStart = null;
    };
    fitStage.onpointercancel = () => {
      fitMoveStart = null;
      fitResizeStart = null;
    };
    fitHandles.forEach((handle) => {
      handle.onpointerdown = (event) => {
        if (!fitProjection || !fitDraft) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        fitStage.setPointerCapture(event.pointerId);
        const corner = handle.dataset.corner ?? 'se';
        const stageRect = fitStage.getBoundingClientRect();
        const oppositeX = stageRect.left + (corner.includes('e')
          ? fitProjection.imageX - fitProjection.imageWidth / 2
          : fitProjection.imageX + fitProjection.imageWidth / 2);
        const oppositeY = stageRect.top + (corner.includes('s')
          ? fitProjection.imageY - fitProjection.imageHeight / 2
          : fitProjection.imageY + fitProjection.imageHeight / 2);
        const cornerX = stageRect.left + (corner.includes('e')
          ? fitProjection.imageX + fitProjection.imageWidth / 2
          : fitProjection.imageX - fitProjection.imageWidth / 2);
        const cornerY = stageRect.top + (corner.includes('s')
          ? fitProjection.imageY + fitProjection.imageHeight / 2
          : fitProjection.imageY - fitProjection.imageHeight / 2);

        fitResizeStart = {
          anchorX: fitProjection.anchorX,
          anchorY: fitProjection.anchorY,
          corner,
          oppositeX,
          oppositeY,
          startDistance: Math.max(1, Math.hypot(cornerX - oppositeX, cornerY - oppositeY)),
          startScale: fitDraft.scale,
          zoom: fitProjection.zoom,
        };
      };
    });
    scaleInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.scale = clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4);
        drawFitEditor();
      }
    };
    offsetXInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.offsetX = parseNumberInput(offsetXInput.value, 0);
        drawFitEditor();
      }
    };
    offsetYInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.offsetY = parseNumberInput(offsetYInput.value, 0);
        drawFitEditor();
      }
    };
    footprintWidthInput.oninput = () => {
      updateFitPreview();
      drawFitEditor();
    };
    footprintHeightInput.oninput = () => {
      updateFitPreview();
      drawFitEditor();
    };
    fitButton.onclick = () => {
      if (!pendingImage) {
        return;
      }

      scaleInput.value = String(getDefaultDefinitionFitScale(
        pendingImage.width,
        pendingImage.height,
        options.assetKind,
      ));
      offsetXInput.value = '0';
      offsetYInput.value = '0';
      updateFitPreview();
    };
    let dragStart: { offsetX: number; offsetY: number; pointerX: number; pointerY: number } | null = null;
    let resizeStart: { pointerX: number; pointerY: number; scale: number } | null = null;
    previewImg.onpointerdown = (event) => {
      if (!pendingImage) {
        return;
      }

      previewImg.setPointerCapture(event.pointerId);
      dragStart = {
        offsetX: parseNumberInput(offsetXInput.value, 0),
        offsetY: parseNumberInput(offsetYInput.value, 0),
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    previewImg.onpointermove = (event) => {
      if (!dragStart) {
        return;
      }

      offsetXInput.value = String(Math.round(dragStart.offsetX + (event.clientX - dragStart.pointerX) / previewProjection.zoom));
      offsetYInput.value = String(Math.round(dragStart.offsetY + (event.clientY - dragStart.pointerY) / previewProjection.zoom));
      updateFitPreview();
    };
    previewImg.onpointerup = () => {
      dragStart = null;
    };
    previewImg.onpointercancel = () => {
      dragStart = null;
    };
    resizeHandle.onpointerdown = (event) => {
      if (!pendingImage) {
        return;
      }

      event.preventDefault();
      resizeHandle.setPointerCapture(event.pointerId);
      resizeStart = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scale: parseNumberInput(scaleInput.value, 1),
      };
    };
    resizeHandle.onpointermove = (event) => {
      if (!resizeStart) {
        return;
      }

      const delta = ((event.clientX - resizeStart.pointerX) + (event.clientY - resizeStart.pointerY)) / 120;
      scaleInput.value = String(Number(clamp(resizeStart.scale + delta, 0.05, 4).toFixed(2)));
      updateFitPreview();
    };
    resizeHandle.onpointerup = () => {
      resizeStart = null;
    };
    resizeHandle.onpointercancel = () => {
      resizeStart = null;
    };

    this.submitHandler = async () => {
      const id = idInput.value.trim();
      const name = nameInput.value.trim() || id;
      const category = categoryInput.value.trim() || (options.assetKind === 'object' ? 'custom' : 'custom tiles');

      if (!id) {
        this.callbacks.setStatus('Custom definition needs an id.');
        return;
      }

      const file = fileInput.files?.[0];
      const preparedImage = pendingImage ?? (file
        ? await prepareDefinitionImageDataUrl(await readFileAsDataUrl(file), options.assetKind, cleanInput.checked)
        : null);
      const textureKey = preparedImage
        ? await this.callbacks.loadTexture(slugifyAssetId(`editor_asset_${id}`), preparedImage.dataUrl)
        : undefined;
      const textureScale = preparedImage
        ? clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4)
        : undefined;
      const textureOffsetX = preparedImage
        ? Math.round(parseNumberInput(offsetXInput.value, 0))
        : undefined;
      const textureOffsetY = preparedImage
        ? Math.round(parseNumberInput(offsetYInput.value, 0))
        : undefined;

      options.onCreate({
        flag: flagInput.checked,
        category,
        footprintHeight: Math.max(1, parseIntegerInput(footprintHeightInput.value, 1)),
        footprintWidth: Math.max(1, parseIntegerInput(footprintWidthInput.value, 1)),
        id,
        name,
        textureDataUrl: preparedImage?.dataUrl,
        textureHeight: preparedImage?.height,
        textureKey,
        textureOffsetX,
        textureOffsetY,
        textureScale,
        textureWidth: preparedImage?.width,
      });
    };

    panel.classList.remove('editor-hidden');
    idInput.focus();
    idInput.select();
  }

  close(): void {
    document.getElementById('ed-definition')?.classList.add('editor-hidden');
    document.getElementById('ed-fit-panel')?.classList.add('editor-hidden');
    this.submitHandler = null;
  }
}

type DefinitionPanelElements = {
  categoryInput: HTMLInputElement;
  cleanInput: HTMLInputElement;
  fileInput: HTMLInputElement;
  fitApplyButton: HTMLButtonElement;
  fitButton: HTMLButtonElement;
  fitCancelButton: HTMLButtonElement;
  fitCloseButton: HTMLButtonElement;
  fitGrid: HTMLCanvasElement;
  fitPanel: HTMLDivElement;
  fitScaleNumber: HTMLInputElement;
  fitScaleRange: HTMLInputElement;
  fitSelection: HTMLDivElement;
  fitStage: HTMLDivElement;
  fitStageGrid: HTMLCanvasElement;
  fitStageImage: HTMLImageElement;
  flagInput: HTMLInputElement;
  flagLabel: HTMLElement;
  footprintHeightInput: HTMLInputElement;
  footprintPanel: HTMLElement;
  footprintWidthInput: HTMLInputElement;
  idInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  offsetXInput: HTMLInputElement;
  offsetYInput: HTMLInputElement;
  openFitButton: HTMLButtonElement;
  panel: HTMLElement;
  preview: HTMLDivElement;
  previewColor: HTMLCanvasElement;
  previewImg: HTMLImageElement;
  resizeHandle: HTMLDivElement;
  scaleInput: HTMLInputElement;
  title: HTMLElement;
};

function getDefinitionPanelElements(): DefinitionPanelElements | null {
  const panel = document.getElementById('ed-definition');
  const title = document.getElementById('ed-definition-title');
  const preview = document.getElementById('ed-definition-preview') as HTMLDivElement | null;
  const fitGrid = document.getElementById('ed-definition-fit-grid') as HTMLCanvasElement | null;
  const idInput = document.getElementById('ed-definition-id') as HTMLInputElement | null;
  const nameInput = document.getElementById('ed-definition-name') as HTMLInputElement | null;
  const categoryInput = document.getElementById('ed-definition-category') as HTMLInputElement | null;
  const footprintPanel = document.getElementById('ed-definition-footprint');
  const footprintWidthInput = document.getElementById('ed-definition-footprint-width') as HTMLInputElement | null;
  const footprintHeightInput = document.getElementById('ed-definition-footprint-height') as HTMLInputElement | null;
  const flagInput = document.getElementById('ed-definition-flag') as HTMLInputElement | null;
  const flagLabel = document.getElementById('ed-definition-flag-label');
  const fileInput = document.getElementById('ed-definition-file') as HTMLInputElement | null;
  const scaleInput = document.getElementById('ed-definition-scale') as HTMLInputElement | null;
  const offsetXInput = document.getElementById('ed-definition-offset-x') as HTMLInputElement | null;
  const offsetYInput = document.getElementById('ed-definition-offset-y') as HTMLInputElement | null;
  const fitButton = document.getElementById('ed-definition-fit') as HTMLButtonElement | null;
  const openFitButton = document.getElementById('ed-definition-open-fit') as HTMLButtonElement | null;
  const cleanInput = document.getElementById('ed-definition-clean') as HTMLInputElement | null;
  const previewImg = document.getElementById('ed-definition-preview-img') as HTMLImageElement | null;
  const previewColor = document.getElementById('ed-definition-preview-color') as HTMLCanvasElement | null;
  const resizeHandle = document.getElementById('ed-definition-resize-handle') as HTMLDivElement | null;
  const fitPanel = document.getElementById('ed-fit-panel') as HTMLDivElement | null;
  const fitCloseButton = document.getElementById('ed-fit-close') as HTMLButtonElement | null;
  const fitCancelButton = document.getElementById('ed-fit-cancel') as HTMLButtonElement | null;
  const fitApplyButton = document.getElementById('ed-fit-apply') as HTMLButtonElement | null;
  const fitStage = document.getElementById('ed-fit-stage') as HTMLDivElement | null;
  const fitStageGrid = document.getElementById('ed-fit-grid') as HTMLCanvasElement | null;
  const fitStageImage = document.getElementById('ed-fit-image') as HTMLImageElement | null;
  const fitSelection = document.getElementById('ed-fit-selection') as HTMLDivElement | null;
  const fitScaleRange = document.getElementById('ed-fit-scale-range') as HTMLInputElement | null;
  const fitScaleNumber = document.getElementById('ed-fit-scale-number') as HTMLInputElement | null;

  if (
    !panel ||
    !title ||
    !preview ||
    !fitGrid ||
    !idInput ||
    !nameInput ||
    !categoryInput ||
    !footprintPanel ||
    !footprintWidthInput ||
    !footprintHeightInput ||
    !flagInput ||
    !flagLabel ||
    !fileInput ||
    !scaleInput ||
    !offsetXInput ||
    !offsetYInput ||
    !fitButton ||
    !openFitButton ||
    !cleanInput ||
    !previewImg ||
    !previewColor ||
    !resizeHandle ||
    !fitPanel ||
    !fitCloseButton ||
    !fitCancelButton ||
    !fitApplyButton ||
    !fitStage ||
    !fitStageGrid ||
    !fitStageImage ||
    !fitSelection ||
    !fitScaleRange ||
    !fitScaleNumber
  ) {
    return null;
  }

  return {
    categoryInput,
    cleanInput,
    fileInput,
    fitApplyButton,
    fitButton,
    fitCancelButton,
    fitCloseButton,
    fitGrid,
    fitPanel,
    fitScaleNumber,
    fitScaleRange,
    fitSelection,
    fitStage,
    fitStageGrid,
    fitStageImage,
    flagInput,
    flagLabel,
    footprintHeightInput,
    footprintPanel,
    footprintWidthInput,
    idInput,
    nameInput,
    offsetXInput,
    offsetYInput,
    openFitButton,
    panel,
    preview,
    previewColor,
    previewImg,
    resizeHandle,
    scaleInput,
    title,
  };
}

function slugifyAssetId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'editor_asset';
}
