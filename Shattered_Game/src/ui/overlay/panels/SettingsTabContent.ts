import type { AudioMixerSettings } from '../../../audio/AudioTypes';
import type { SfxEventId } from '../../../audio/SfxTypes';

type VolumeKey = 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'uiVolume';
type ToggleKey = 'musicEnabled' | 'sfxEnabled' | 'uiEnabled';

type SliderControl = {
  input: HTMLInputElement;
  value: HTMLElement;
};

type ToggleControl = HTMLButtonElement;

const FALLBACK_AUDIO_SETTINGS: AudioMixerSettings = {
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  uiVolume: 0.7,
  musicEnabled: true,
  sfxEnabled: true,
  uiEnabled: true,
};

export class SettingsTabContent {
  readonly el: HTMLElement;

  private readonly sliders = new Map<VolumeKey, SliderControl>();
  private readonly toggles = new Map<ToggleKey, ToggleControl>();

  constructor(
    private readonly onClearSave: () => void = () => {},
    private readonly onUiSfx: (id: SfxEventId) => void = () => {},
    private readonly getAudioSettings: () => AudioMixerSettings = () => ({ ...FALLBACK_AUDIO_SETTINGS }),
    private readonly onAudioSettingsChange: (settings: Partial<AudioMixerSettings>) => void = () => {},
  ) {
    this.el = document.createElement('div');
    this.el.className = 'settings-tab';

    const body = document.createElement('div');
    body.className = 'settings-body';

    const audioGroup = this.createGroup('Audio');
    audioGroup.append(
      this.createSliderRow('Master', 'masterVolume'),
      this.createChannelRow('Music', 'musicEnabled', 'musicVolume'),
      this.createChannelRow('Game SFX', 'sfxEnabled', 'sfxVolume'),
      this.createChannelRow('UI Sounds', 'uiEnabled', 'uiVolume'),
    );

    const saveGroup = this.createGroup('Save');
    const clearBtn = document.createElement('button');
    clearBtn.className = 'settings-danger-btn';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear Save Data';
    clearBtn.addEventListener('click', () => {
      this.onUiSfx('ui_button');
      if (confirm('Delete all save data and restart? This cannot be undone.')) {
        this.onClearSave();
      }
    });
    saveGroup.appendChild(clearBtn);

    body.append(audioGroup, saveGroup);
    this.el.appendChild(body);
    this.update();
  }

  update(): void {
    const settings = this.readSettings();

    this.syncSlider('masterVolume', settings.masterVolume);
    this.syncSlider('musicVolume', settings.musicVolume);
    this.syncSlider('sfxVolume', settings.sfxVolume);
    this.syncSlider('uiVolume', settings.uiVolume);

    this.syncToggle('musicEnabled', settings.musicEnabled);
    this.syncToggle('sfxEnabled', settings.sfxEnabled);
    this.syncToggle('uiEnabled', settings.uiEnabled);
  }

  private createGroup(label: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'settings-group';

    const heading = document.createElement('div');
    heading.className = 'settings-group-label';
    heading.textContent = label;

    group.appendChild(heading);
    return group;
  }

  private createChannelRow(label: string, toggleKey: ToggleKey, sliderKey: VolumeKey): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-audio-row';

    const line = document.createElement('div');
    line.className = 'settings-control-line';

    const text = document.createElement('span');
    text.className = 'settings-label';
    text.textContent = label;

    const toggle = document.createElement('button');
    toggle.className = 'settings-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${label} enabled`);
    toggle.addEventListener('click', () => {
      const settings = this.readSettings();
      const next: Partial<AudioMixerSettings> = { [toggleKey]: !settings[toggleKey] };
      this.onUiSfx('ui_button');
      this.onAudioSettingsChange(next);
      this.update();
    });

    this.toggles.set(toggleKey, toggle);
    line.append(text, toggle);
    row.append(line, this.createSliderControl(label, sliderKey));
    return row;
  }

  private createSliderRow(label: string, sliderKey: VolumeKey): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-audio-row';

    const line = document.createElement('div');
    line.className = 'settings-control-line';

    const text = document.createElement('span');
    text.className = 'settings-label';
    text.textContent = label;

    line.appendChild(text);
    row.append(line, this.createSliderControl(label, sliderKey));
    return row;
  }

  private createSliderControl(label: string, sliderKey: VolumeKey): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-volume-row';

    const input = document.createElement('input');
    input.className = 'settings-range';
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.setAttribute('aria-label', `${label} volume`);

    const value = document.createElement('span');
    value.className = 'settings-value';

    input.addEventListener('input', () => {
      const nextValue = Number(input.value) / 100;
      const next: Partial<AudioMixerSettings> = { [sliderKey]: nextValue };
      value.textContent = formatPercent(nextValue);
      this.onAudioSettingsChange(next);
    });

    input.addEventListener('change', () => {
      this.onUiSfx('ui_button');
    });

    this.sliders.set(sliderKey, { input, value });
    wrap.append(input, value);
    return wrap;
  }

  private syncSlider(key: VolumeKey, rawValue: number): void {
    const slider = this.sliders.get(key);
    if (!slider) return;

    const value = clamp01(rawValue);
    const percent = String(Math.round(value * 100));
    if (slider.input.value !== percent) {
      slider.input.value = percent;
    }
    slider.value.textContent = `${percent}%`;
  }

  private syncToggle(key: ToggleKey, enabled: boolean): void {
    const toggle = this.toggles.get(key);
    if (!toggle) return;

    toggle.classList.toggle('on', enabled);
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  private readSettings(): AudioMixerSettings {
    try {
      return {
        ...FALLBACK_AUDIO_SETTINGS,
        ...this.getAudioSettings(),
      };
    } catch {
      return { ...FALLBACK_AUDIO_SETTINGS };
    }
  }
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
