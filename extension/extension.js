/**
 * Copyright (C) 2023 Jeff Shee (jeffshee8969@gmail.com)
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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as GnomeShellOverride from './gnomeShellOverride.js';
import * as Launcher from './launcher.js';
import * as WindowManager from './windowManager.js';
import * as PlaybackState from './playbackState.js';
import * as AutoPause from './autoPause.js';
import * as PanelMenu from './panelMenu.js';
import * as Performance from './performance.js';
import * as Snapshot from './snapshot.js';

export default class HanabiExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.isEnabled = false;
        this.launchRendererId = 0;
        this.currentProcess = null;
        this.reloadTime = 100;
        this.perfMonitor = null;
        this.extensionLoadStartTime = 0;
        this.extensionLoadTime = 0;

        /**
         * This is a safeguard measure for the case of Gnome Shell being relaunched
         *  (for example, under X11, with Alt+F2 and R), to kill any old renderer process.
         */
        this.killAllProcesses();
    }

    enable() {
        // Track extension load time - measure entire enable() phase
        this.extensionLoadStartTime = GLib.get_monotonic_time() / 1000;

        this.settings = this.getSettings();
        this.playbackState = new PlaybackState.PlaybackState();

        // Initialize performance monitor
        this.perfMonitor = new Performance.PerformanceMonitor();
        this.snapshotManager = new Snapshot.SnapshotManager(this);

        // Record load time immediately after core initialization
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this.extensionLoadTime = (GLib.get_monotonic_time() / 1000) - this.extensionLoadStartTime;
            try {
                this.settings.set_double('last-load-time', this.extensionLoadTime);
                console.log(`[Hanabi] Extension loaded in ${this.extensionLoadTime.toFixed(2)}ms`);
            } catch (e) {
                console.error(`[Hanabi] Failed to save load time: ${e.message}`);
            }
            return false;
        });

        /**
         * Panel Menu
         */
        this.panelMenu = new PanelMenu.HanabiPanelMenu(this);
        if (this.settings.get_boolean('show-panel-menu'))
            this.panelMenu.enable();

        this.settings.connect('changed::show-panel-menu', () => {
            if (this.settings.get_boolean('show-panel-menu'))
                this.panelMenu.enable();
            else
                this.panelMenu.disable();
        });

        /**
         * Disable startup animation (Workaround for issue #65)
         */
        this.old_hasOverview = Main.sessionMode.hasOverview;

        if (Main.layoutManager._startingUp) {
            Main.sessionMode.hasOverview = false;
            Main.layoutManager.connect('startup-complete', () => {
                Main.sessionMode.hasOverview = this.old_hasOverview;
            });
            // Handle Ubuntu's method
            if (Main.layoutManager.startInOverview)
                Main.layoutManager.startInOverview = false;
        }

        /**
         * Other overrides
         */
        this.override = new GnomeShellOverride.GnomeShellOverride();
        this.manager = new WindowManager.WindowManager();
        this.autoPause = new AutoPause.AutoPause(this);

        // If the desktop is still starting up, wait until it is ready
        if (Main.layoutManager._startingUp) {
            this.startupCompleteId = Main.layoutManager.connect(
                'startup-complete',
                () => {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.settings.get_int('startup-delay'), () => {
                        Main.layoutManager.disconnect(this.startupCompleteId);
                        this.startupCompleteId = null;
                        // Reset timer to measure only innerEnable() time
                        this.extensionLoadStartTime = GLib.get_monotonic_time() / 1000;
                        this.innerEnable();
                        return false;
                    });
                }
            );
        } else {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.settings.get_int('startup-delay'), () => {
                // Reset timer to measure only innerEnable() time
                this.extensionLoadStartTime = GLib.get_monotonic_time() / 1000;
                this.innerEnable();
                return false;
            });
        }
    }

    innerEnable() {
        this.override.enable();
        this.manager.enable();
        this.autoPause.enable();

        this.isEnabled = true;
        if (this.launchRendererId)
            GLib.source_remove(this.launchRendererId);

        this.launchRenderer();
        console.log('[Hanabi Snapshot] Shell manager enable call');
        this.snapshotManager.enable();
        try {
            const debugPath = GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'hanabi', 'inner-enable.txt']);
            GLib.file_set_contents(debugPath, `innerEnable ${new Date().toISOString()}\n`);
        } catch (e) {
            console.error(`[Hanabi Snapshot] Failed to write innerEnable debug file: ${e.message}`);
        }

        // Record total load time
        this.extensionLoadTime = (GLib.get_monotonic_time() / 1000) - this.extensionLoadStartTime;

        // Save load time to settings for display in preferences
        try {
            this.settings.set_double('last-load-time', this.extensionLoadTime);
            console.log(`[Hanabi] Load time saved: ${this.extensionLoadTime.toFixed(2)}ms`);
        } catch (e) {
            console.error(`[Hanabi] Failed to save load time: ${e.message}`);
        }

        // Log load time if debug mode is enabled
        if (this.settings.get_boolean('debug-mode'))
            console.log(`[Hanabi] Extension loaded in ${this.extensionLoadTime.toFixed(2)}ms`);
    }

    getPlaybackState() {
        return this.playbackState;
    }

    /**
     * Get extension load time for settings display
     */
    getExtensionLoadTime() {
        return this.extensionLoadTime;
    }

    launchRenderer() {
        // Launch preferences dialog for first-time user
        const videoPath = this.settings.get_string('video-path');
        // TODO: check if the path is exist or not instead
        if (videoPath === '')
            this.openPreferences();

        this.reloadTime = 100;
        const argv = [];
        argv.push(
            GLib.build_filenamev([
                this.path,
                'renderer',
                'renderer.js',
            ])
        );
        // TODO: recheck `-P` argument
        argv.push('-P', this.path);
        argv.push('-F', videoPath);

        try {
            this.currentProcess = new Launcher.LaunchSubprocess();
            this.currentProcess.set_cwd(GLib.get_home_dir());
            this.currentProcess.spawnv(argv);
            this.manager.set_wayland_client(this.currentProcess);

            /**
             * If the renderer dies, wait 100ms and relaunch it, unless the exit status is different than zero,
             * in which case it will wait one second. This is done this way to avoid relaunching the renderer
             * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
             */
            this.currentProcess.subprocess.wait_async(null, (obj, res) => {
                try {
                    obj.wait_finish(res);
                    if (!this.currentProcess || obj !== this.currentProcess.subprocess)
                        return;

                    if (obj.get_if_exited()) {
                        const retval = obj.get_exit_status();
                        if (retval !== 0)
                            this.reloadTime = 1000;
                    } else {
                        this.reloadTime = 1000;
                    }
                    this.currentProcess = null;
                    this.manager.set_wayland_client(null);

                    if (this.isEnabled) {
                        if (this.launchRendererId)
                            GLib.source_remove(this.launchRendererId);

                        // Use lower priority and add small delay to prevent CPU spikes
                        this.launchRendererId = GLib.timeout_add(
                            GLib.PRIORITY_LOW,
                            this.reloadTime,
                            () => {
                                this.launchRendererId = 0;
                                // Add small delay before relaunch to let system breathe
                                GLib.idle_add(GLib.PRIORITY_LOW, () => {
                                    this.launchRenderer();
                                    return false;
                                });
                                return false;
                            }
                        );
                    }
                } catch (e) {
                    logError(`Renderer crash handler error: ${e.message}`);
                    this.cleanupCurrentProcess();
                }
            });
        } catch (e) {
            logError(`Failed to launch renderer: ${e.message}`);
            this.cleanupCurrentProcess();
        }
    }

    cleanupCurrentProcess() {
        if (this.currentProcess) {
            try {
                if (this.currentProcess.subprocess) {
                    this.currentProcess.cancellable.cancel();
                    this.currentProcess.subprocess.send_signal(15);
                }
            } catch (e) {
                logError(`Error cleaning up process: ${e.message}`);
            }
            this.currentProcess = null;
        }
        this.manager.set_wayland_client(null);
    }

    disable() {
        // Clean up performance monitor
        if (this.perfMonitor) {
            this.perfMonitor.destroy();
            this.perfMonitor = null;
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.settings.get_int('startup-delay'), () => {
            this.override.disable();
            return false;
        });

        this.settings = null;
        this.panelMenu.disable();
        Main.sessionMode.hasOverview = this.old_hasOverview;
        this.manager.disable();
        this.autoPause.disable();
        if (this.snapshotManager) {
            this.snapshotManager.disable();
            this.snapshotManager = null;
        }

        this.isEnabled = false;
        this.killCurrentProcess();
    }

    killCurrentProcess() {
        // If a reload was pending, kill it and schedule a new reload.
        if (this.launchRendererId) {
            GLib.source_remove(this.launchRendererId);
            this.launchRendererId = 0;
            if (this.isEnabled) {
                this.launchRendererId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this.reloadTime,
                    () => {
                        this.launchRendererId = 0;
                        this.launchRenderer();
                        return false;
                    }
                );
            }
        }

        // Kill the renderer. It will be reloaded automatically.
        if (this.currentProcess && this.currentProcess.subprocess) {
            this.currentProcess.cancellable.cancel();
            this.currentProcess.subprocess.send_signal(15);
        }
    }

    killAllProcesses() {
        const procFolder = Gio.File.new_for_path('/proc');
        if (!procFolder.query_exists(null))
            return;

        const fileEnum = procFolder.enumerate_children(
            'standard::*',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        let info;
        while ((info = fileEnum.next_file(null))) {
            const filename = info.get_name();
            if (!filename)
                break;

            const processPath = GLib.build_filenamev(['/proc', filename, 'cmdline']);
            const processUser = Gio.File.new_for_path(processPath);
            if (!processUser.query_exists(null))
                continue;

            const [binaryData, etag_] = processUser.load_bytes(null);
            const readData = binaryData.get_data();

            // Optimized: Use array join instead of string concatenation
            const charArray = [];
            for (let i = 0; i < readData.length; i++)
                charArray.push(readData[i] < 32 ? ' ' : String.fromCharCode(readData[i]));

            const contents = charArray.join('');
            const path =
                `gjs ${
                    GLib.build_filenamev([
                        this.path,
                        'renderer',
                        'renderer.js',
                    ])}`;
            if (contents.startsWith(path)) {
                const proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
                proc.init(null);
                proc.wait(null);
            }
        }
    }
}
