/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { mergeClasses } from "@griffel/react";
import * as React from "react";
import { ChromePicker, ColorResult } from "react-color";

import { createRandomColor } from "../createRandomColor";
import { useDebounce } from "../useDebounce";

import { useStyles } from "./ColorPicker.styles";

type ColorPickerProps = {
    /**
     * The initial color to display in the color picker.
     * If null, a random color will be used.
     */
    initialColor: string | null;

    /**
     * Callback to be called when the color changes.
     * @param color The new color.
     */
    onColorChange: (color: string) => void;

    /**
     * Optional className to apply to the swatch.
     */
    className?: string;
};

/**
 * A color picker component with a swatch that opens a color picker when clicked.
 * @param props The properties for the ColorPicker component.
 * @returns A ColorPicker component.
 */
export const ColorPicker: React.FC<ColorPickerProps> = props => {
    const { onColorChange } = props;

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [color, setColor] = React.useState(props.initialColor ?? createRandomColor(true));
    const [, setPreviousColor] = React.useState(color);
    const wrapperRef = React.useRef(null);
    const debouncedColor = useDebounce(color, 1000);
    const classes = useStyles();

    React.useEffect(() => {
        // react to changes in the initial color
        // in case the initial color is null, generate a random color
        const initialColor = props.initialColor ?? createRandomColor(true);

        setColor(prev => (prev === initialColor ? prev : initialColor));
    }, [props.initialColor]);

    const onSwatchClick = React.useCallback(() => {
        setPickerOpen(prev => !prev);
    }, []);

    const onPickerClose = React.useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        // make sure that we are not closing the picker when clicking on the swatch
        if (e.target === wrapperRef.current) {
            setPickerOpen(false);
        }
    }, []);

    React.useEffect(() => {
        setPreviousColor(prev => {
            if (prev === debouncedColor) {
                return prev;
            }

            onColorChange(debouncedColor);
            return debouncedColor;
        });
    }, [onColorChange, debouncedColor]);

    const onPickerColorChange = React.useCallback(
        (color: ColorResult) => {
            setColor(color.hex);
            onColorChange(color.hex);
        },
        [onColorChange]
    );

    return (
        <>
            <span
                onClick={onSwatchClick}
                className={mergeClasses(classes.swatch, props.className)}
                style={{
                    backgroundColor: color,
                }}></span>
            {pickerOpen ? (
                <div className={classes.popover}>
                    <div className={classes.cover} ref={wrapperRef} onClick={onPickerClose}>
                        <ChromePicker color={color} onChange={onPickerColorChange} />
                    </div>
                </div>
            ) : null}
        </>
    );
};











