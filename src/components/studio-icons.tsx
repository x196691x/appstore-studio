import type { ComponentProps } from 'react';
import brand from '../assets/figma/e912d.svg';
import download from '../assets/figma/8707f.svg';
import upload from '../assets/figma/3fbb6.svg';
import uploadCard from '../assets/figma/4512b.svg';
import search from '../assets/figma/06497.svg';
import chevron from '../assets/figma/a92ef.svg';
import fontChevron from '../assets/figma/c4f51.svg';
import generate from '../assets/figma/61bd7.svg';
import layers from '../assets/figma/16349.svg';
import refresh from '../assets/figma/78cad.svg';
import phone from '../assets/figma/48dee.svg';
import tablet from '../assets/figma/ed6f0.svg';

const icon = (src: string, size: number) => function StudioIcon({ className = '', ...props }: ComponentProps<'img'>) {
  return <img {...props} src={src} alt="" aria-hidden="true" width={size} height={size} className={`studio-icon ${className}`} style={{ width: size, height: size }} />;
};
export const BrandIcon = icon(brand, 24);
export const DownloadIcon = icon(download, 16);
export const UploadIcon = icon(upload, 16);
export const UploadCardIcon = icon(uploadCard, 20);
export const SearchIcon = icon(search, 16);
export const ChevronIcon = icon(chevron, 16);
export const FontChevronIcon = icon(fontChevron, 16);
export const GenerateIcon = icon(generate, 16);
export const LayersIcon = icon(layers, 24);
export const RefreshIcon = icon(refresh, 16);
export const PhoneIcon = icon(phone, 16);
export const TabletIcon = icon(tablet, 16);
