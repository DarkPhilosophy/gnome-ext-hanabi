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

const schemaId = 'io.github.jeffshee.hanabi-extension';
const logPrefix = 'Hanabi:';

const LogLevel = {
    VERBOSE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
};

const LOG_LEVEL_NAMES = {
    [LogLevel.VERBOSE]: '[VERBOSE]',
    [LogLevel.DEBUG]: '[DEBUG]',
    [LogLevel.INFO]: '[INFO]',
    [LogLevel.WARN]: '[WARN]',
    [LogLevel.ERROR]: '[ERROR]',
};

let currentLogLevel = LogLevel.WARN;
let logToFileEnabled = false;
let currentLogFilePath = null;
let logFileInitialized = false;

export class Logger {
    constructor(opt = undefined) {
        const settingsSchemaSource = Gio.SettingsSchemaSource.get_default();
        if (settingsSchemaSource.lookup(schemaId, false))
            this._settings = Gio.Settings.new(schemaId);

        this.logPrefix = logPrefix;
        this.logOpt = opt;

        if (this._settings) {
            const updateLogSettings = () => {
                const debugEnabled = this._settings.get_boolean('debug-mode');
                if (!debugEnabled) {
                    currentLogLevel = LogLevel.WARN;
                    logToFileEnabled = false;
                    currentLogFilePath = null;
                    logFileInitialized = false;
                    return;
                }

                const selected = this._settings.get_int('log-level');
                const normalized = Math.max(LogLevel.VERBOSE, Math.min(LogLevel.ERROR, selected));
                currentLogLevel = normalized;
                logToFileEnabled = this._settings.get_boolean('log-to-file');
                if (logToFileEnabled) {
                    const resolved = resolveLogFilePath(this._settings);
                    if (resolved !== currentLogFilePath) {
                        logFileInitialized = false;
                        currentLogFilePath = resolved;
                    }
                    initLogFile(currentLogFilePath);
                } else {
                    currentLogFilePath = null;
                    logFileInitialized = false;
                }
            };

            updateLogSettings();
            this._settings.connect('changed::debug-mode', updateLogSettings);
            this._settings.connect('changed::log-level', updateLogSettings);
            this._settings.connect('changed::log-to-file', updateLogSettings);
            this._settings.connect('changed::log-filepath', updateLogSettings);
        }
    }

    _processArgs(args) {
        const base = this.logOpt ? `${this.logPrefix} (${this.logOpt})` : this.logPrefix;
        return [base, ...args];
    }

    log(...args) {
        this._logAtLevel(LogLevel.INFO, console.log, args);
    }

    debug(...args) {
        this._logAtLevel(LogLevel.DEBUG, console.log, args);
    }

    warn(...args) {
        this._logAtLevel(LogLevel.WARN, console.warn, args);
    }

    error(...args) {
        this._logAtLevel(LogLevel.ERROR, console.error, args);
    }

    trace(...args) {
        const message = this._formatMessageWithLevel(LogLevel.DEBUG, args);
        if (LogLevel.DEBUG < currentLogLevel)
            return;
        console.trace(message);
        this._writeToFile(message);
    }

    _logAtLevel(level, consoleFn, args) {
        if (level < currentLogLevel)
            return;
        const message = this._formatMessageWithLevel(level, args);
        consoleFn(message);
        this._writeToFile(message);
    }

    _formatMessageWithLevel(level, args) {
        const timestamp = new Date().toISOString();
        const levelName = LOG_LEVEL_NAMES[level] ?? LOG_LEVEL_NAMES[LogLevel.DEBUG];
        const prefix = `${timestamp} ${levelName} ${this.logOpt ? `${this.logPrefix} (${this.logOpt})` : this.logPrefix}`;
        const content = this._processArgs(args)
            .slice(1)
            .map(arg => formatValue(arg))
            .join(' ');
        return `${prefix} ${content}`;
    }

    _writeToFile(message) {
        if (!logToFileEnabled || !currentLogFilePath)
            return;
        appendLogLine(currentLogFilePath, message);
    }
}

/**
 *
 * @param settings
 */
function resolveLogFilePath(settings) {
    const configured = settings.get_string('log-filepath').trim();
    if (configured.length === 0)
        return GLib.build_filenamev([GLib.get_user_cache_dir(), 'hanabi', 'hanabi.log']);

    if (configured.startsWith('/'))
        return configured;

    return GLib.build_filenamev([GLib.get_home_dir(), configured]);
}

/**
 *
 * @param path
 */
function ensureLogDirectory(path) {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();
    if (parent && !parent.query_exists(null)) {
        try {
            parent.make_directory_with_parents(null);
        } catch (error) {
            console.error(`[Hanabi] Failed to create log dir: ${error.message}`);
        }
    }
}

/**
 *
 * @param path
 */
function rotateLogFile(path) {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null))
        return;

    const oldFile = Gio.File.new_for_path(`${path}.old`);
    if (oldFile.query_exists(null)) {
        try {
            oldFile.delete(null);
        } catch (error) {
            console.error(`[Hanabi] Failed to delete old log: ${error.message}`);
        }
    }

    try {
        file.move(oldFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    } catch (error) {
        console.error(`[Hanabi] Failed to rotate log: ${error.message}`);
    }
}

/**
 *
 * @param path
 */
function initLogFile(path) {
    if (logFileInitialized && path === currentLogFilePath)
        return;
    ensureLogDirectory(path);
    rotateLogFile(path);
    logFileInitialized = true;
}

/**
 *
 * @param path
 * @param line
 */
function appendLogLine(path, line) {
    try {
        ensureLogDirectory(path);
        const file = Gio.File.new_for_path(path);
        const output = `${line}\n`;
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        const bytes = new TextEncoder().encode(output);
        stream.write_all(bytes, null);
        stream.close(null);
    } catch (error) {
        console.error(`[Hanabi] Failed to write log: ${error.message}`);
    }
}

/**
 *
 * @param value
 */
function formatValue(value) {
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}


/**
 * List all methods of an object in JavaScript
 * Ref: https://flaviocopes.com/how-to-list-object-methods-javascript/
 *
 * @param obj
 */
export const getMethods = obj => {
    const properties = new Set();
    let currentObj = obj;
    do
        Object.getOwnPropertyNames(currentObj).map(item => properties.add(item));
    while ((currentObj = Object.getPrototypeOf(currentObj)));
    return [...properties.keys()].filter(item => typeof obj[item] === 'function');
};
