/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import { ChromePicker, ColorResult } from "react-color";

import { createRandomColor } from "../createRandomColor";
import { useDebounce } from "../useDebounce";

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
     * Optional style properties.
     */
    style?: React.CSSProperties;
};

/**
 * A color picker component with a swatch that opens a color picker when clicked.
 * @param props The properties for the ColorPicker component.
 * @returns A ColorPicker component.
 */
export const ColorPicker: React.FC<ColorPickerProps> = props => {
    const { onColorChange } = props;

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [color, setColor] = React.useState(props.initialColor ?? createRandomColor());
    const [previousColor, setPreviousColor] = React.useState(color);
    const wrapperRef = React.useRef(null);
    const debouncedColor = useDebounce(color);

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
        if (debouncedColor !== previousColor) {
            setPreviousColor(debouncedColor);
            onColorChange(debouncedColor);
        }
    }, [onColorChange, previousColor, debouncedColor]);

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
                style={{
                    backgroundColor: color,
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "50%",
                    marginLeft: "auto",
                    alignSelf: "center",
                    cursor: "pointer",
                    ...props.style,
                }}></span>
            {pickerOpen ? (
                <div
                    style={{
                        position: "absolute",
                        zIndex: "2",
                    }}>
                    <div
                        ref={wrapperRef}
                        onClick={onPickerClose}
                        style={{
                            position: "fixed",
                            top: "0px",
                            right: "0px",
                            bottom: "0px",
                            left: "0px",
                        }}>
                        <ChromePicker color={color} onChange={onPickerColorChange} />
                    </div>
                </div>
            ) : null}
        </>
    );
};

