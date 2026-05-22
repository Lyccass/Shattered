import type { SavedDirtyChunkBundleRecord, SavedEditorMapRecord } from '../io/EditorLocalLibrary';

type LibraryActionHandlers = {
  onDelete: (recordId: string) => void;
  onLoad: (recordId: string) => void;
};

type LibraryCardOptions = {
  actionLabel: string;
  meta: string;
  name: string;
  onDelete: () => void;
  onLoad: () => void;
  previewDataUrl: string;
};

export class EditorLibraryPanelController {
  private eventsBound = false;

  bindGlobalEvents(): void {
    if (this.eventsBound) {
      return;
    }

    this.eventsBound = true;
    document.getElementById('ed-library-close')?.addEventListener('click', () => this.close());
  }

  showMaps(records: SavedEditorMapRecord[], handlers: LibraryActionHandlers): void {
    this.show({
      emptyMessage: 'No saved maps yet.',
      records,
      renderCard: (record) => createLibraryCard({
        actionLabel: 'Open',
        meta: `${record.width}x${record.height} saved ${formatShortDate(record.savedAt)}`,
        name: record.displayName,
        onDelete: () => handlers.onDelete(record.id),
        onLoad: () => handlers.onLoad(record.id),
        previewDataUrl: record.previewDataUrl,
      }),
      title: 'Open Map',
    });
  }

  showChunks(records: SavedDirtyChunkBundleRecord[], handlers: LibraryActionHandlers): void {
    this.show({
      emptyMessage: 'No saved chunk bundles yet.',
      records,
      renderCard: (record) => createLibraryCard({
        actionLabel: 'Apply',
        meta: `${record.sourceMapId} saved ${formatShortDate(record.savedAt)}`,
        name: `${record.regionId} (${record.chunkCount} chunks)`,
        onDelete: () => handlers.onDelete(record.id),
        onLoad: () => handlers.onLoad(record.id),
        previewDataUrl: record.previewDataUrl,
      }),
      title: 'Apply Chunks',
    });
  }

  close(): void {
    const panel = document.getElementById('ed-library');

    if (panel) {
      panel.style.display = 'none';
    }
  }

  private show<T>(config: {
    emptyMessage: string;
    records: T[];
    renderCard: (record: T) => HTMLElement;
    title: string;
  }): void {
    const panel = document.getElementById('ed-library');
    const title = document.getElementById('ed-library-title');
    const grid = document.getElementById('ed-library-grid');
    const empty = document.getElementById('ed-library-empty');

    if (!panel || !title || !grid || !empty) {
      return;
    }

    title.textContent = config.title;
    grid.innerHTML = '';
    empty.textContent = config.emptyMessage;
    empty.style.display = config.records.length === 0 ? '' : 'none';

    for (const record of config.records) {
      grid.appendChild(config.renderCard(record));
    }

    panel.style.display = 'flex';
  }
}

function createLibraryCard(options: LibraryCardOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = 'ed-library-card';
  card.role = 'button';
  card.tabIndex = 0;

  const preview = document.createElement('img');
  preview.className = 'ed-library-preview';
  preview.src = options.previewDataUrl;
  preview.alt = '';

  const name = document.createElement('div');
  name.className = 'ed-library-name';
  name.textContent = options.name;

  const meta = document.createElement('div');
  meta.className = 'ed-library-meta';
  meta.textContent = options.meta;

  const actions = document.createElement('div');
  actions.className = 'ed-library-actions';

  const load = document.createElement('button');
  load.className = 'ed-library-action';
  load.type = 'button';
  load.textContent = options.actionLabel;
  load.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onLoad();
  });

  const remove = document.createElement('button');
  remove.className = 'ed-library-action';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onDelete();
  });

  actions.append(load, remove);
  card.append(preview, name, meta, actions);
  card.addEventListener('click', options.onLoad);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      options.onLoad();
    }
  });
  return card;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
