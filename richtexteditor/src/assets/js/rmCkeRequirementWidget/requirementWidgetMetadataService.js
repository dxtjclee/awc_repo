// Copyright (c) 2022 Siemens

let exports = {};
let specDataAttributesMap = [];
let imageDataMap = [];
let oleDataMap = [];

// Image
export let setSpecImageData = function( imageData ) {
    imageDataMap = imageData;
};

export let pushSpecImageData = function( imageData ) {
    Object.keys( imageData ).forEach( ( key ) => imageDataMap[key] = imageData[key] );
};

export let getSpecImageData = function( alt ) {
    return imageDataMap[alt];
};

// OLE
export let setSpecOLEData = function( oleData ) {
    oleDataMap = oleData;
};

export let pushSpecOLEData = function( oleData ) {
    Object.keys( oleData ).forEach( ( key ) => oleDataMap[key] = oleData[key] );
};

export let getSpecOLEData = function( oleid ) {
    return oleDataMap[oleid];
};

// Requirement/BodyText
export let setSpecDataAttributes = function( specData ) {
    specDataAttributesMap = specData;
};

export let pushSpecDataAttributes = function( specData ) {
    specDataAttributesMap = specDataAttributesMap.concat( specData );
};

export let getSpecDataAttributes = function( id ) {
    return specDataAttributesMap[id];
};

export default exports = {
    setSpecImageData,
    getSpecImageData,
    pushSpecImageData,
    setSpecOLEData,
    getSpecOLEData,
    pushSpecOLEData,
    setSpecDataAttributes,
    getSpecDataAttributes,
    pushSpecDataAttributes
};
