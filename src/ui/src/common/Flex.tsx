/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

type FlexProps = {
    /**
     * The flex direction.
     */
    direction: "row" | "column";

    /**
     * The flex grow.
     */
    grow?: number;

    /**
     * The flex shrink.
     */
    shrink?: number;

    /**
     * The flex wrap.
     */
    wrap?: "wrap" | "nowrap" | "wrap-reverse";

    /**
     * The flex align items.
     */
    alignItems?: "flex-start" | "flex-end" | "center" | "baseline" | "stretch";

    /**
     * The flex justify content.
     */
    justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";

    /**
     * When true, the flex container will fill the horizontal space.
     */
    hFill?: boolean;

    /**
     * The children.
     */
    children: React.ReactNode;

    /**
     * Optional style.
     */
    style?: React.CSSProperties;
};

/**
 * A simple flex component that uses the flexbox layout.
 * @param props The flex props.
 * @returns A simple flex component.
 */
export const Flex: React.FC<FlexProps> = props => {
    const style: React.CSSProperties = {
        display: "flex",
        flexDirection: props.direction,
        flexGrow: props.grow,
        flexShrink: props.shrink,
        flexWrap: props.wrap,
        alignItems: props.alignItems,
        justifyContent: props.justifyContent,
        width: props.hFill ? "100%" : undefined,
        ...props.style,
    };

    return <div style={style}>{props.children}</div>;
};



