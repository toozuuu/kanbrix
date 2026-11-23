import {useEffect} from "react";
import {useTranslation} from "react-i18next";
import {usePreferences} from "../pages/PersonalSettings";
export function LanguageSync(){
 const prefs=usePreferences();const {i18n:instance}=useTranslation();
 useEffect(()=>{const lang=(prefs.data?.language || navigator.language).split("-")[0];void instance.changeLanguage(lang==="sv"?"sv":"en");},[prefs.data?.language,instance]);
 useEffect(()=>{document.documentElement.lang=instance.resolvedLanguage??"en";},[instance.resolvedLanguage]);
 return null;
}
