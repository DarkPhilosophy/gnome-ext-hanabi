/**
 * Copyright (C) 2026 Jeff Shee (jeffshee8969@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import GLib from 'gi://GLib';

import * as DBus from './dbus.js';
import * as Logger from './logger.js';

const SNAPSHOT_DELAY_MS = 1200;
export class SnapshotManager {
    constructor(extension) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._renderer = new DBus.RendererWrapper();
        this._logger = new Logger.Logger('snapshot');

        this._applied = false;
        this._pending = false;
        this._timeoutId = 0;
        this._lastVideoPath = '';
        this._isPlayingSignalId = 0;
        this._settingsChangedId = 0;
    }

    enable() {
        this._lastVideoPath = this._settings.get_string('video-path');
        this._resetState(this._lastVideoPath);

        this._settingsChangedId = this._settings.connect('changed::video-path', () => {
            const path = this._settings.get_string('video-path');
            this._resetState(path);
        });

        this._isPlayingSignalId = this._renderer.proxy.connectSignal(
            'isPlayingChanged',
            (_proxy, _sender, [isPlaying]) => {
                if (isPlaying)
                    this._scheduleSnapshot('signal');
            }
        );

        try {
            if (this._renderer.proxy.isPlaying)
                this._scheduleSnapshot('initial');
        } catch (e) {
            this._logger.warn(`Failed to read isPlaying: ${e.message}`);
        }
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        if (this._isPlayingSignalId) {
            this._renderer.proxy.disconnectSignal(this._isPlayingSignalId);
            this._isPlayingSignalId = 0;
        }
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._pending = false;
    }

    _resetState(videoPath) {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._applied = false;
        this._pending = false;
        this._lastVideoPath = videoPath || '';
        this._logger.log(`Snapshot state reset (video='${this._lastVideoPath || 'none'}')`);
    }

    _scheduleSnapshot(reason) {
        if (this._applied || this._pending)
            return;
        if (!this._lastVideoPath)
            return;

        this._pending = true;
        this._logger.debug(`Scheduling snapshot (${reason})`);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, SNAPSHOT_DELAY_MS, () => {
            this._timeoutId = 0;
            this._applySnapshot();
            return false;
        });
    }

    _applySnapshot() {
        if (this._applied)
            return;

        this._logger.debug('Requesting renderer snapshot');
        const cacheDir = GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'hanabi']);
        const snapshotPath = GLib.build_filenamev([cacheDir, 'snapshot.png']);
        this._renderer.proxy.TakeVideoFrameSnapshotAsync(snapshotPath, (proxy, res) => {
            try {
                proxy.TakeVideoFrameSnapshotFinish(res);
                this._logger.log('Renderer snapshot request complete');
            } catch (e) {
                this._logger.warn(`Renderer snapshot request failed: ${e.message}`);
            }
            this._applied = true;
            this._pending = false;
        });
    }
}
