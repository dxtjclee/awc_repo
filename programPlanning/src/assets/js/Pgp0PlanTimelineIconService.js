// Copyright (c) 2022 Siemens

export const addIconLayer = function( ganttInstance ) {
    if( !ganttInstance || ganttInstance.iconLayerId ) {
        return;
    }
    ganttInstance.iconLayerId = ganttInstance.addTaskLayer( ganttTask => {
        return ganttTask.getOverlayIcon && ganttTask.getOverlayIcon( ganttTask, ganttInstance );
    } );
};

export default {
    addIconLayer
};
