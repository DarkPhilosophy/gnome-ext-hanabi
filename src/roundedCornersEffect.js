/**
 * Copyright (C) 2023 Jeff Shee (jeffshee8969@gmail.com)
 * Copyright (C) 2022 Alynx Zhou (alynx.zhou@gmail.com)
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

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

import * as Logger from './logger.js';

const logger = new Logger.Logger('roundedCorners');

/**
 * Rounded corners effect for GNOME Shell 49+
 * Minimal effect that stores parameters but doesn't modify painting
 * (Actual rounding is handled at a different layer in GNOME 49)
 */
export const RoundedCornersEffect = GObject.registerClass(
    class RoundedCornersEffect extends Clutter.Effect {
        _init(params = {}) {
            super._init(params);

            this._bounds = [0, 0, 1, 1];
            this._clipRadius = 0;
            this._pixelStep = [1, 1];
        }

        setBounds(bounds) {
            logger.debug('bounds:', ...bounds);
            this._bounds = bounds;
        }

        setClipRadius(clipRadius) {
            logger.debug('clipRadius:', clipRadius);
            this._clipRadius = clipRadius;
        }

        setPixelStep(pixelStep) {
            logger.debug('pixelStep:', ...pixelStep);
            this._pixelStep = pixelStep;
        }
    }
);
