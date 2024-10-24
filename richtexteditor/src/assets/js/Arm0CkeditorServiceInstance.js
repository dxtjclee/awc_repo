// Copyright (c) 2022 Siemens

/**
 * Module for Maintaining the ckeditor 5 service instance
 *
 * @module js/Arm0CkeditorServiceInstance
 */
export let ckeditor5ServiceInstance = null;
export let ckeditorInstance = null;

/**
  * Ckeditor5 Object Setter
  */
export let setCkeditor5ServiceInstance = function( ckeditorServiceInstance )  {
    ckeditor5ServiceInstance = ckeditorServiceInstance;
};

/**
  * Ckeditor5 Object Setter
  */
export let setCkeditor5Instance = function( ckInstance )  {
    ckeditorInstance = ckInstance;
};

/**
  * Ckeditor5 Object Getter
  */
export let getCkeditor5ServiceInstance = function()  {
    return ckeditor5ServiceInstance;
};

export default exports = {
    // getCkeditor5ServiceInstance,
    setCkeditor5ServiceInstance,
    setCkeditor5Instance,
    ckeditor5ServiceInstance,
    ckeditorInstance
};

var exports = {};
