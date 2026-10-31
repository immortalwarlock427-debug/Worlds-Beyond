async function openCharacterMenu(page) {
  if (!await page.locator('#characterMenu').evaluate(el => el.open))
    await page.locator('#characterMenu > summary').click();
}
module.exports = {openCharacterMenu};
