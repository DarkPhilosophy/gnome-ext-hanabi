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

/**
 * Credit:
 * This code draws significant inspiration from the implementation of
 * LaunchSubprocess in the DING extension.
 */

import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Logger from './logger.js';

const logger = new Logger.Logger();
const rendererLogger = new Logger.Logger('renderer');

export class LaunchSubprocess {
    constructor(flags = Gio.SubprocessFlags.NONE) {
        this._isX11 = !Meta.is_wayland_compositor();

        this._flags =
            flags |
            Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_MERGE;

        this.cancellable = new Gio.Cancellable();
        this._launcher = new Gio.SubprocessLauncher({flags: this._flags});
        // if (!this._isX11)
        //     this._waylandClient = Meta.WaylandClient.new(global.context, this._launcher);

        this.subprocess = null;
        this.running = false;
    }

    spawnv(argv) {
        if (!this._isX11) {
            // this.subprocess = this._waylandClient.spawnv(global.display, argv);
            this._waylandClient = Meta.WaylandClient.new_subprocess(global.context, this._launcher, argv);
            this.subprocess = this._waylandClient.get_subprocess();
        } else {
            this.subprocess = this._launcher.spawnv(argv);
        }

        // This is for GLib 2.68 or greater
        if (this._launcher.close)
            this._launcher.close();

        this._launcher = null;
        if (this.subprocess) {
            // Read STDOUT and STDERR from the renderer with better error handling
            try {
                this._dataInputStream = Gio.DataInputStream.new(
                    this.subprocess.get_stdout_pipe()
                );
                this.running = true;
                this.read_output();
                this.subprocess.wait_async(this.cancellable, () => {
                    try {
                        this.running = false;
                        if (this._dataInputStream) {
                            this._dataInputStream.close(null);
                            this._dataInputStream = null;
                        }
                        this.cancellable = null;
                    } catch (e) {
                        logError(`Error in subprocess cleanup: ${e.message}`);
                    }
                });
            } catch (e) {
                logError(`Failed to initialize subprocess I/O: ${e.message}`);
                this.running = false;
            }
        }
        return this.subprocess;
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    read_output() {
        if (!this._dataInputStream || !this.running)
            return;

        try {
            this._dataInputStream.read_line_async(
                GLib.PRIORITY_LOW, // Use lower priority to avoid blocking UI
                this.cancellable,
                (object, res) => {
                    try {
                        const [output, length] = object.read_line_finish_utf8(res);
                        if (length && output) {
                            const isSnapshotLine = output.includes('Hanabi Snapshot');
                            // Optimized: Use array instead of string concatenation
                            this._outputLines = this._outputLines || [];
                            this._outputLines.push(output);

                            // Flush buffer every 10 lines, if too large, or for snapshot debug lines
                            const bufferSize = this._outputLines.reduce((sum, line) => sum + line.length, 0);
                            if (isSnapshotLine || this._outputLines.length >= 10 || bufferSize >= 4096) {
                                rendererLogger.log(this._outputLines.join('\n'));
                                this._outputLines = [];
                            }
                        }
                    } catch (e) {
                        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                            return;

                        logger.trace(`Read error: ${e.message}`);
                    }

                    // Add small delay to prevent tight loop
                    if (this.running) {
                        GLib.timeout_add(GLib.PRIORITY_LOW, 10, () => {
                            this.read_output();
                            return false;
                        });
                    }
                }
            );
        } catch (e) {
            logger.trace(`Failed to read output: ${e.message}`);
        }
    }

    /**
     * Queries whether the passed window belongs to the launched subprocess or not.
     *
     * @param {MetaWindow} window The window to check.
     */
    query_window_belongs_to(window) {
        if (this._isX11)
            return false;

        if (!this.running)
            return false;

        try {
            return this._waylandClient.owns_window(window);
        } catch (e) {
            logger.trace(e);
            return false;
        }
    }

    query_pid_of_program() {
        if (!this.running)
            return 0;

        const pid = this.subprocess.get_identifier();
        return pid ? parseInt(pid) : 0;
    }

    // show_in_window_list(window) {
    //     if (!this._isX11 && this.running)
    //         this._waylandClient.show_in_window_list(window);
    // }

    // hide_from_window_list(window) {
    //     if (!this._isX11 && this.running)
    //         this._waylandClient.hide_from_window_list(window);
    // }
}
