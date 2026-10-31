-- Limit new cloud writes at the database boundary as well as in the browser.
-- NOT VALID preserves any pre-existing oversized copies so owners can export
-- and reduce them. Inserts and updates are still checked immediately.
alter table public.wb_characters
  add constraint wb_characters_document_size
  check (octet_length(document::text) <= 3000000) not valid;
