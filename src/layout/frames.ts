/**
 * v9 page widths. Lists and tables share the wide frame so page edges line up
 * from one page to the next; forms and documents use the reading frame. Both
 * open up on screens 1440px and wider so big monitors aren't mostly margin.
 */
export const FRAME_WIDE = 'mx-auto w-full max-w-[1080px] min-[1440px]:max-w-[1240px]'

export const FRAME_FORM = 'mx-auto w-full max-w-[720px] min-[1440px]:max-w-[880px]'
